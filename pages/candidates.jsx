import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function CandidatesPage() {
  const router = useRouter();
  const { status } = router.query;
  const [candidates, setCandidates] = useState([]);
  const [filteredCandidates, setFilteredCandidates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status) {
      fetchCandidates();
    }
  }, [status]);

  useEffect(() => {
    // Filter candidates based on search query
    if (!searchQuery.trim()) {
      setFilteredCandidates(candidates);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = candidates.filter(candidate => 
        candidate.name.toLowerCase().includes(query) ||
        candidate.rollNumber.toLowerCase().includes(query) ||
        candidate.department.toLowerCase().includes(query) ||
        candidate.email.toLowerCase().includes(query)
      );
      setFilteredCandidates(filtered);
    }
  }, [searchQuery, candidates]);

  async function fetchCandidates() {
    setLoading(true);
    try {
      const res = await fetch(`/api/candidates-by-status?status=${status}`);
      const data = await res.json();
      setCandidates(data.candidates || []);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  const getTitle = () => {
    if (status === 'ALL') return 'All Candidates';
    if (status === 'SCHEDULED') return 'Scheduled Candidates';
    if (status === 'COMPLETED') return 'Completed Candidates';
    return 'Candidates';
  };

  const getStatusColor = (candidateStatus) => {
    if (candidateStatus === 'SCHEDULED') return 'bg-green-100 text-green-800';
    if (candidateStatus === 'COMPLETED') return 'bg-purple-100 text-purple-800';
    if (candidateStatus === 'PENDING') return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading candidates...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← Back to Home
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{getTitle()}</h1>
            <span className="ml-auto text-lg font-semibold text-gray-600">
              {filteredCandidates.length} {filteredCandidates.length === 1 ? 'candidate' : 'candidates'}
              {searchQuery && ` (filtered from ${candidates.length})`}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by name, roll number, department, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border text-black border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {filteredCandidates.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">
              {searchQuery ? `No candidates found matching "${searchQuery}"` : 'No candidates found'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCandidates.map((candidate) => (
              <div
                key={candidate.id}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-gray-900">{candidate.name}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(candidate.status)}`}
                  >
                    {candidate.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium w-24">Roll No:</span>
                    <span>{candidate.rollNumber}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium w-24">Department:</span>
                    <span>{candidate.department}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium w-24">Year:</span>
                    <span>Year {candidate.year}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <span className="font-medium w-24">Email:</span>
                    <span className="text-xs truncate">{candidate.email}</span>
                  </div>
                </div>

                {candidate.interviews && candidate.interviews.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="text-xs text-gray-500 mb-1">
                      {status === 'COMPLETED' ? 'Interview Completed' : 'Scheduled Interview'}
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {new Date(candidate.interviews[0].startTime).toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                    {candidate.interviews[0].oc1 && candidate.interviews[0].oc2 && (
                      <div className="text-xs text-gray-600 mt-1">
                        Interviewers: {candidate.interviews[0].oc1.name} & {candidate.interviews[0].oc2.name}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
