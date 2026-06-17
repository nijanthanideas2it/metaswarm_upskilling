import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  type PieLabelRenderProps,
} from 'recharts';
import { Layout } from '../../components/Layout';
import {
  statusCounts,
  priorityBreakdown,
  categoryBreakdown,
  atRiskTickets,
  type AtRiskTicket,
} from './dummy-data';

const PRIORITY_COLORS: Record<AtRiskTicket['priority'], string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-green-100 text-green-700',
};

interface StatCardProps {
  label: string;
  value: number;
  colorClass: string;
}

function StatCard({ label, value, colorClass }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

export function ReportingDashboardPage() {
  return (
    <Layout>
      <div className="p-6 max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Operations Overview</h2>
            <p className="text-sm text-gray-500 mt-0.5">Live ticket status across the support team</p>
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
            Auto-refreshes every 5 min
          </span>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard label="Open" value={statusCounts.open} colorClass="text-blue-600" />
          <StatCard label="In Progress" value={statusCounts.inProgress} colorClass="text-indigo-600" />
          <StatCard label="Pending" value={statusCounts.pending} colorClass="text-yellow-600" />
          <StatCard label="Resolved (this week)" value={statusCounts.resolvedThisWeek} colorClass="text-green-600" />
          <StatCard label="Closed (this week)" value={statusCounts.closedThisWeek} colorClass="text-gray-600" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Priority Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Open Tickets by Priority</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priorityBreakdown} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="priority" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v) => [v, 'Tickets']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {priorityBreakdown.map((entry) => (
                    <Cell key={entry.priority} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Open Tickets by Category</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }: PieLabelRenderProps) =>
                    `${String(name)} ${((Number(percent) || 0) * 100).toFixed(0)}%`
                  }
                >
                  {categoryBreakdown.map((entry) => (
                    <Cell key={entry.category} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [v, 'Tickets']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* At-Risk Tickets */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <h3 className="text-sm font-semibold text-gray-700">
              At-Risk Tickets
              <span className="ml-2 text-xs font-normal text-gray-400">
                — open with no agent response for &gt;24 hours
              </span>
            </h3>
          </div>
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Reference', 'Customer', 'Category', 'Priority', 'Hours Open'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {atRiskTickets.map((ticket) => (
                <tr key={ticket.ref} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm font-medium text-blue-600">{ticket.ref}</td>
                  <td className="px-5 py-3 text-sm text-gray-700">{ticket.customer}</td>
                  <td className="px-5 py-3 text-sm text-gray-500">{ticket.category}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[ticket.priority]}`}
                    >
                      {ticket.priority}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-700 font-medium">
                    {ticket.hoursOpen}h
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
