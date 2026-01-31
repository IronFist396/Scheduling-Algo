/**
 * Algorithm Comparison Utility
 * Runs all scheduling algorithms and compares their performance
 */

const currentAlgorithm = require('./scheduler');
const mostAvailableAlgorithm = require('./scheduler-most-available');
const randomAlgorithm = require('./scheduler-random');
const balancedAlgorithm = require('./scheduler-balanced');

/**
 * Run all algorithms and compare results
 */
async function compareAlgorithms(candidates, ocs, startDate, maxDays = 999) {
  console.log('\n' + '='.repeat(80));
  console.log('🔬 ALGORITHM COMPARISON STARTED');
  console.log('='.repeat(80));
  console.log(`Dataset: ${candidates.length} candidates, ${ocs.length} OCs`);
  console.log(`Start Date: ${startDate}`);
  console.log(`Max Days: ${maxDays}`);
  console.log('='.repeat(80) + '\n');

  const algorithms = [
    { name: 'Current (Least Available First)', module: currentAlgorithm },
    { name: 'Most Available First', module: mostAvailableAlgorithm },
    { name: 'Random Order', module: randomAlgorithm },
    { name: 'Workload Balancing', module: balancedAlgorithm },
  ];

  const results = [];

  for (const algo of algorithms) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Running: ${algo.name}`);
    console.log('='.repeat(80));

    const startTime = Date.now();
    
    try {
      const stats = algo.module.scheduleInterviews(candidates, ocs, startDate, maxDays);
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      results.push({
        algorithmName: algo.name,
        scheduled: stats.scheduled,
        unscheduled: stats.unscheduled,
        daysUsed: stats.daysUsed,
        weeksUsed: stats.weeksUsed,
        executionTime,
        interviewsByDay: stats.interviewsByDay,
        loadStats: stats.loadStats || null,
      });

      console.log(`✅ Completed in ${executionTime}ms`);
    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
      results.push({
        algorithmName: algo.name,
        error: error.message,
        executionTime: Date.now() - startTime,
      });
    }
  }

  // Generate comparison report
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 COMPARISON RESULTS');
  console.log('='.repeat(80) + '\n');

  const comparisonTable = results.map(r => ({
    Algorithm: r.algorithmName,
    Scheduled: r.scheduled || 'ERROR',
    Unscheduled: r.unscheduled || '-',
    'Days Used': r.daysUsed || '-',
    'Weeks Used': r.weeksUsed || '-',
    'Exec Time (ms)': r.executionTime,
  }));

  console.table(comparisonTable);

  // Find best algorithm for each metric
  const validResults = results.filter(r => !r.error);

  const bestScheduled = validResults.reduce((best, curr) => 
    curr.scheduled > best.scheduled ? curr : best, validResults[0]);

  const bestDaysUsed = validResults.reduce((best, curr) => 
    curr.daysUsed < best.daysUsed ? curr : best, validResults[0]);

  const bestExecutionTime = validResults.reduce((best, curr) => 
    curr.executionTime < best.executionTime ? curr : best, validResults[0]);

  console.log('\n🏆 WINNERS BY METRIC:');
  console.log(`   Most Scheduled: ${bestScheduled.algorithmName} (${bestScheduled.scheduled})`);
  console.log(`   Fewest Days: ${bestDaysUsed.algorithmName} (${bestDaysUsed.daysUsed} days, ${bestDaysUsed.weeksUsed} weeks)`);
  console.log(`   Fastest: ${bestExecutionTime.algorithmName} (${bestExecutionTime.executionTime}ms)`);

  // Load distribution analysis
  console.log('\n📈 LOAD DISTRIBUTION ANALYSIS:');
  validResults.forEach(result => {
    if (result.interviewsByDay) {
      const loads = Object.values(result.interviewsByDay);
      const avgLoad = loads.reduce((sum, l) => sum + l, 0) / loads.length;
      const maxLoad = Math.max(...loads);
      const minLoad = Math.min(...loads);
      const variance = maxLoad - minLoad;

      console.log(`\n   ${result.algorithmName}:`);
      console.log(`      Avg interviews/day: ${avgLoad.toFixed(2)}`);
      console.log(`      Min interviews/day: ${minLoad}`);
      console.log(`      Max interviews/day: ${maxLoad}`);
      console.log(`      Variance: ${variance} (${variance === 0 ? 'perfectly balanced' : 'unbalanced'})`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('🔬 COMPARISON COMPLETE');
  console.log('='.repeat(80) + '\n');

  return {
    results,
    winners: {
      mostScheduled: bestScheduled,
      fewestDays: bestDaysUsed,
      fastest: bestExecutionTime,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Run comparison with multiple iterations for random algorithm
 */
async function compareAlgorithmsMultiRun(candidates, ocs, startDate, maxDays = 999, iterations = 5) {
  console.log('\n' + '='.repeat(80));
  console.log('🔬 MULTI-RUN ALGORITHM COMPARISON');
  console.log('='.repeat(80));
  console.log(`Running each algorithm ${iterations} times to account for randomness`);
  console.log('='.repeat(80) + '\n');

  const algorithms = [
    { name: 'Current (Least Available First)', module: currentAlgorithm },
    { name: 'Most Available First', module: mostAvailableAlgorithm },
    { name: 'Random Order', module: randomAlgorithm },
    { name: 'Workload Balancing', module: balancedAlgorithm },
  ];

  const aggregatedResults = [];

  for (const algo of algorithms) {
    console.log(`\nRunning ${algo.name} ${iterations} times...`);
    
    const runs = [];
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      const stats = algo.module.scheduleInterviews(candidates, ocs, startDate, maxDays);
      const endTime = Date.now();

      runs.push({
        scheduled: stats.scheduled,
        unscheduled: stats.unscheduled,
        daysUsed: stats.daysUsed,
        weeksUsed: stats.weeksUsed,
        executionTime: endTime - startTime,
      });

      console.log(`   Run ${i + 1}/${iterations}: ${stats.daysUsed} days, ${stats.scheduled} scheduled`);
    }

    // Calculate averages
    const avgScheduled = runs.reduce((sum, r) => sum + r.scheduled, 0) / runs.length;
    const avgDaysUsed = runs.reduce((sum, r) => sum + r.daysUsed, 0) / runs.length;
    const avgExecutionTime = runs.reduce((sum, r) => sum + r.executionTime, 0) / runs.length;

    const minDays = Math.min(...runs.map(r => r.daysUsed));
    const maxDays = Math.max(...runs.map(r => r.daysUsed));

    aggregatedResults.push({
      algorithmName: algo.name,
      avgScheduled: avgScheduled.toFixed(2),
      avgDaysUsed: avgDaysUsed.toFixed(2),
      minDays,
      maxDays,
      avgExecutionTime: avgExecutionTime.toFixed(2),
      runs,
    });
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('📊 MULTI-RUN COMPARISON RESULTS');
  console.log('='.repeat(80) + '\n');

  const comparisonTable = aggregatedResults.map(r => ({
    Algorithm: r.algorithmName,
    'Avg Scheduled': r.avgScheduled,
    'Avg Days Used': r.avgDaysUsed,
    'Min Days': r.minDays,
    'Max Days': r.maxDays,
    'Avg Exec Time (ms)': r.avgExecutionTime,
  }));

  console.table(comparisonTable);

  const bestAvgDays = aggregatedResults.reduce((best, curr) => 
    parseFloat(curr.avgDaysUsed) < parseFloat(best.avgDaysUsed) ? curr : best, aggregatedResults[0]);

  const bestMinDays = aggregatedResults.reduce((best, curr) => 
    curr.minDays < best.minDays ? curr : best, aggregatedResults[0]);

  console.log('\n🏆 WINNERS (Multi-Run):');
  console.log(`   Best Average Days: ${bestAvgDays.algorithmName} (${bestAvgDays.avgDaysUsed} days avg)`);
  console.log(`   Best Minimum Days: ${bestMinDays.algorithmName} (${bestMinDays.minDays} days best run)`);

  console.log('\n' + '='.repeat(80));
  console.log('🔬 MULTI-RUN COMPARISON COMPLETE');
  console.log('='.repeat(80) + '\n');

  return {
    results: aggregatedResults,
    iterations,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  compareAlgorithms,
  compareAlgorithmsMultiRun,
};
