import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export async function exportScheduleToPDF() {
  try {
    // Fetch all interviews
    const res = await fetch('/api/interviews?all=true');
    const data = await res.json();
    const interviews = data.interviews || [];

    if (interviews.length === 0) {
      alert('No interviews to export!');
      return;
    }

    // Create PDF
    const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
    
    // Title
    pdf.setFontSize(18);
    pdf.setFont(undefined, 'bold');
    pdf.text('ISMP Interview Schedule 2026', 148, 15, { align: 'center' });
    
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'normal');
    pdf.text(`Generated on: ${format(new Date(), 'PPpp')}`, 148, 22, { align: 'center' });
    
    // Group interviews by week
    const weekGroups = {};
    interviews.forEach(interview => {
      const week = Math.ceil(interview.dayNumber / 5);
      if (!weekGroups[week]) {
        weekGroups[week] = [];
      }
      weekGroups[week].push(interview);
    });

    let startY = 30;
    
    // Generate table for each week
    Object.keys(weekGroups).sort((a, b) => parseInt(a) - parseInt(b)).forEach((week, index) => {
      const weekInterviews = weekGroups[week];
      
      // Add new page for each week except the first
      if (index > 0) {
        pdf.addPage();
        startY = 15;
      }
      
      // Week header
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      const weekStartDay = (parseInt(week) - 1) * 5 + 1;
      const weekEndDay = parseInt(week) * 5;
      pdf.text(`Week ${week} (Days ${weekStartDay}-${weekEndDay})`, 14, startY);
      
      startY += 8;
      
      // Prepare table data
      const tableData = weekInterviews.map(interview => {
        const date = format(new Date(interview.startTime), 'MMM dd, yyyy');
        const time = format(new Date(interview.startTime), 'h:mm a');
        const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][(interview.dayNumber - 1) % 5];
        
        return [
          `Day ${interview.dayNumber}`,
          dayName,
          date,
          time,
          interview.candidate.name,
          interview.candidate.rollNumber,
          interview.candidate.department,
          `${interview.oc1.name} & ${interview.oc2.name}`,
          interview.status
        ];
      });
      
      // Generate table
      autoTable(pdf, {
        startY: startY,
        head: [['Day', 'DoW', 'Date', 'Time', 'Candidate', 'Roll No', 'Dept', 'Interviewers', 'Status']],
        body: tableData,
        styles: { 
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: { 
          fillColor: [59, 130, 246], // Blue
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250]
        },
        columnStyles: {
          0: { cellWidth: 12 },  // Day
          1: { cellWidth: 12 },  // DoW
          2: { cellWidth: 25 },  // Date
          3: { cellWidth: 20 },  // Time
          4: { cellWidth: 40 },  // Candidate
          5: { cellWidth: 25 },  // Roll No
          6: { cellWidth: 35 },  // Dept
          7: { cellWidth: 50 },  // Interviewers
          8: { cellWidth: 25 }   // Status
        },
        didDrawCell: (data) => {
          // Highlight completed interviews in green
          if (data.column.index === 8 && data.cell.raw === 'COMPLETED') {
            pdf.setTextColor(34, 197, 94); // Green
          }
        },
        didParseCell: (data) => {
          // Color status cells
          if (data.column.index === 8) {
            if (data.cell.raw === 'COMPLETED') {
              data.cell.styles.textColor = [34, 197, 94]; // Green
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.raw === 'SCHEDULED') {
              data.cell.styles.textColor = [59, 130, 246]; // Blue
            }
          }
        }
      });
      
      // Update startY for next week
      startY = pdf.lastAutoTable.finalY + 15;
    });
    
    // Footer on last page
    const pageCount = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont(undefined, 'normal');
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Page ${i} of ${pageCount}`, 148, 200, { align: 'center' });
      pdf.text('SMP - IIT Bombay', 148, 205, { align: 'center' });
    }
    
    // Save the PDF
    pdf.save(`ISMP_Interview_Schedule_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF. Please try again.');
  }
}
