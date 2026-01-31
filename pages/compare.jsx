import { useState } from 'react';
import Head from 'next/head';

export default function AlgorithmComparison() {
  const [loading, setLoading] = useState(false);
  const [comparisonResults, setComparisonResults] = useState(null);
  const [error, setError] = useState(null);
  const [multiRun, setMultiRun] = useState(false);
  const [iterations, setIterations] = useState(5);

  const runComparison = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/compare-algorithms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiRun, iterations }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Comparison failed');
      }

      setComparisonResults(data.comparison);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Algorithm Comparison - Interview Scheduler</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              🔬 Algorithm Comparison
            </h1>
            <p className="mt-2 text-gray-600">
              Compare different scheduling algorithms to find the most efficient approach
            </p>
          </div>

          {/* Control Panel */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Comparison Settings
            </h2>

            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={multiRun}
                    onChange={(e) => setMultiRun(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-gray-700">
                    Multi-Run Mode (accounts for randomness)
                  </span>
                </label>
              </div>

              {multiRun && (
                <div className="ml-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Iterations: {iterations}
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="10"
                    value={iterations}
                    onChange={(e) => setIterations(parseInt(e.target.value))}
                    className="w-64"
                  />
                </div>
              )}

              <button
                onClick={runComparison}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? '⏳ Running Comparison...' : '▶️ Run Comparison'}
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
              <p className="text-red-800 font-medium">❌ Error: {error}</p>
            </div>
          )}

          {/* Results Display */}
          {comparisonResults && !multiRun && (
            <div className="space-y-6">
              {/* Results Table */}
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 bg-gray-800 text-white">
                  <h2 className="text-xl font-semibold">📊 Comparison Results</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Algorithm
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Scheduled
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unscheduled
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Days Used
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Weeks Used
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Exec Time (ms)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {comparisonResults.results.map((result, index) => {
                        const isWinner = result.algorithmName === comparisonResults.winners.fewestDays.algorithmName;
                        return (
                          <tr key={index} className={isWinner ? 'bg-green-50' : ''}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {isWinner && <span className="mr-2">🏆</span>}
                                <span className="text-sm font-medium text-gray-900">
                                  {result.algorithmName}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                              {result.scheduled}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                              {result.unscheduled}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-gray-900">
                              {result.daysUsed}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                              {result.weeksUsed}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                              {result.executionTime}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Winners */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  🏆 Winners by Metric
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-600 font-medium mb-1">Most Scheduled</p>
                    <p className="text-lg font-bold text-green-900">
                      {comparisonResults.winners.mostScheduled.algorithmName}
                    </p>
                    <p className="text-sm text-green-700">
                      {comparisonResults.winners.mostScheduled.scheduled} candidates
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-600 font-medium mb-1">Fewest Days</p>
                    <p className="text-lg font-bold text-blue-900">
                      {comparisonResults.winners.fewestDays.algorithmName}
                    </p>
                    <p className="text-sm text-blue-700">
                      {comparisonResults.winners.fewestDays.daysUsed} days ({comparisonResults.winners.fewestDays.weeksUsed} weeks)
                    </p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-sm text-purple-600 font-medium mb-1">Fastest</p>
                    <p className="text-lg font-bold text-purple-900">
                      {comparisonResults.winners.fastest.algorithmName}
                    </p>
                    <p className="text-sm text-purple-700">
                      {comparisonResults.winners.fastest.executionTime}ms
                    </p>
                  </div>
                </div>
              </div>

              {/* Load Distribution */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  📈 Load Distribution Analysis
                </h2>
                <div className="space-y-4">
                  {comparisonResults.results.map((result, index) => {
                    if (!result.interviewsByDay) return null;
                    const loads = Object.values(result.interviewsByDay);
                    const avgLoad = (loads.reduce((sum, l) => sum + l, 0) / loads.length).toFixed(2);
                    const maxLoad = Math.max(...loads);
                    const minLoad = Math.min(...loads);
                    const variance = maxLoad - minLoad;

                    return (
                      <div key={index} className="border-b border-gray-200 pb-4 last:border-b-0">
                        <h3 className="font-semibold text-gray-900 mb-2">
                          {result.algorithmName}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Avg/day</p>
                            <p className="font-medium text-gray-900">{avgLoad}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Min/day</p>
                            <p className="font-medium text-gray-900">{minLoad}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Max/day</p>
                            <p className="font-medium text-gray-900">{maxLoad}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Variance</p>
                            <p className="font-medium text-gray-900">
                              {variance} {variance === 0 && '✅'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Multi-Run Results */}
          {comparisonResults && multiRun && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="px-6 py-4 bg-gray-800 text-white">
                  <h2 className="text-xl font-semibold">
                    📊 Multi-Run Results ({comparisonResults.iterations} iterations each)
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Algorithm
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Scheduled
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Days Used
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Min Days
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Max Days
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Exec Time (ms)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {comparisonResults.results.map((result, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {result.algorithmName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                            {result.avgScheduled}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-gray-900">
                            {result.avgDaysUsed}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 font-medium">
                            {result.minDays}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-red-600">
                            {result.maxDays}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                            {result.avgExecutionTime}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Info Panel */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">
              ℹ️ About the Algorithms
            </h3>
            <div className="space-y-2 text-sm text-blue-800">
              <p>
                <strong>Current (Least Available First):</strong> Schedules candidates with fewer available slots first to avoid conflicts later
              </p>
              <p>
                <strong>Most Available First:</strong> Opposite approach - schedules flexible candidates first
              </p>
              <p>
                <strong>Random Order:</strong> Baseline comparison with random candidate ordering
              </p>
              <p>
                <strong>Workload Balancing:</strong> Distributes interviews evenly across days to avoid overloading
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
