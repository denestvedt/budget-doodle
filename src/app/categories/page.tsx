'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Category {
  id: string
  name: string
  group_name: string
  type: 'Income' | 'Expense' | 'Transfer'
  is_hidden: boolean
  sort_order: number
}

const GROUP_ORDER = ['Income', 'Living', 'Discretionary', 'Financial', 'Transfer', 'Other']
const GROUP_TYPES: Record<string, 'Income' | 'Expense' | 'Transfer'> = {
  Income: 'Income',
  Living: 'Expense',
  Discretionary: 'Expense',
  Financial: 'Expense',
  Transfer: 'Transfer',
  Other: 'Expense',
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showHidden, setShowHidden] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState('Discretionary')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editGroup, setEditGroup] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('categories')
      .select('id, name, group_name, type, is_hidden, sort_order')
      .order('group_name')
      .order('sort_order')
      .order('name')
    setCategories(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const createCategory = async () => {
    if (!newName.trim()) return
    setSaving(true)
    await supabase.from('categories').insert({
      name: newName.trim(),
      group_name: newGroup,
      type: GROUP_TYPES[newGroup] || 'Expense',
      is_hidden: false,
    })
    setCreating(false)
    setNewName('')
    setNewGroup('Discretionary')
    setSaving(false)
    loadData()
  }

  const saveEdit = async (id: string) => {
    setSaving(true)
    await supabase
      .from('categories')
      .update({
        name: editName,
        group_name: editGroup,
        type: GROUP_TYPES[editGroup] || 'Expense',
      })
      .eq('id', id)
    setEditingId(null)
    setSaving(false)
    loadData()
  }

  const toggleHidden = async (id: string, current: boolean) => {
    await supabase.from('categories').update({ is_hidden: !current }).eq('id', id)
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_hidden: !current } : c))
    )
  }

  const filteredCategories = showHidden
    ? categories
    : categories.filter((c) => !c.is_hidden)

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    categories: filteredCategories.filter((c) => c.group_name === group),
  })).filter((g) => g.categories.length > 0)

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: '#1E3A5F' }}>
            Categories
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {categories.filter((c) => !c.is_hidden).length} active categories
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
              className="rounded"
            />
            Show hidden
          </label>
          <button onClick={() => setCreating(true)} className="btn-primary">
            + Add Category
          </button>
        </div>
      </div>

      {/* Create form */}
      {creating && (
        <div className="card mb-6">
          <div className="card-header">
            <h3 className="font-semibold text-sm" style={{ color: '#1E3A5F' }}>New Category</h3>
          </div>
          <div className="card-body">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="form-label">Category Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Coffee, Dog Food"
                  className="form-input"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && createCategory()}
                />
              </div>
              <div className="w-48">
                <label className="form-label">Group</label>
                <select
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  className="form-input"
                >
                  {GROUP_ORDER.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button onClick={createCategory} disabled={saving} className="btn-primary">Create</button>
                <button onClick={() => setCreating(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ group, categories: cats }) => (
            <div key={group} className="card overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#f0f4f9' }}>
                <h3 className="font-bold text-sm uppercase tracking-wide" style={{ color: '#1E3A5F' }}>
                  {group}
                </h3>
                <span className="text-xs text-gray-500">{cats.length} categories</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {cats.map((cat) => (
                    <tr key={cat.id} className={`border-b border-gray-50 hover:bg-gray-50 ${cat.is_hidden ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 flex-1">
                        {editingId === cat.id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="form-input py-1 flex-1 max-w-xs"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(cat.id)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                            />
                            <select
                              value={editGroup}
                              onChange={(e) => setEditGroup(e.target.value)}
                              className="form-input py-1 w-40"
                            >
                              {GROUP_ORDER.map((g) => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                            <button onClick={() => saveEdit(cat.id)} className="btn-primary py-1 text-xs">Save</button>
                            <button onClick={() => setEditingId(null)} className="btn-secondary py-1 text-xs">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-gray-800">{cat.name}</span>
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: cat.type === 'Income' ? '#d1fae5' : cat.type === 'Transfer' ? '#dbeafe' : '#fee2e2',
                                color: cat.type === 'Income' ? '#065f46' : cat.type === 'Transfer' ? '#1e40af' : '#991b1b',
                              }}
                            >
                              {cat.type}
                            </span>
                            {cat.is_hidden && <span className="text-xs text-gray-400">Hidden</span>}
                          </div>
                        )}
                      </td>
                      {editingId !== cat.id && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingId(cat.id)
                                setEditName(cat.name)
                                setEditGroup(cat.group_name)
                              }}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggleHidden(cat.id, cat.is_hidden)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              {cat.is_hidden ? 'Show' : 'Hide'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
