export default function FamilyAccounts() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">👨‍👩‍👧‍👦 Family Accounts</h1>
        <p className="text-gray-400 text-sm mt-1">Manage shared wallets and family expense tracking</p>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 text-center space-y-4">
        <span className="text-5xl">🚀</span>
        <h2 className="text-white font-bold text-xl">Family Accounts</h2>
        <p className="text-gray-400">Create a family group to share expenses, budgets, and financial goals with household members. Track shared bills, split expenses, and monitor family financial health together.</p>
        <div className="grid grid-cols-2 gap-4 text-left">
          {['Shared wallet tracking', 'Expense splitting', 'Family budgets', 'Permission control', 'Multi-user access', 'Shared financial goals'].map(f => (
            <div key={f} className="flex items-center gap-2 text-gray-400 text-sm"><span className="text-green-500">✓</span>{f}</div>
          ))}
        </div>
        <button className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-medium transition-all hover:from-green-500 hover:to-emerald-500">
          Create Family Group
        </button>
      </div>
    </div>
  )
}
