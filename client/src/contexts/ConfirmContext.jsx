import { createContext, useContext, useState, useCallback } from 'react'
import { AlertTriangle, Info, X } from 'lucide-react'

const ConfirmContext = createContext(null)

function ConfirmDialog({ title, message, type = 'danger', confirmText, cancelText, onConfirm, onCancel }) {
  const isDanger = type === 'danger'
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-[fadeIn_.15s_ease]">
        <div className={`px-5 py-4 flex items-start gap-3 ${isDanger ? 'bg-red-50' : 'bg-blue-50'}`}>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isDanger ? 'bg-red-100' : 'bg-blue-100'}`}>
            {isDanger
              ? <AlertTriangle size={17} className="text-red-600"/>
              : <Info size={17} className="text-blue-600"/>}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-sm ${isDanger ? 'text-red-800' : 'text-blue-800'}`}>{title}</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{message}</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 shrink-0">
            <X size={16}/>
          </button>
        </div>
        <div className="px-5 py-4 flex gap-3 justify-end">
          <button
            className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            onClick={onCancel}
          >
            {cancelText || 'Batal'}
          </button>
          <button
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmText || (isDanger ? 'Hapus' : 'Konfirmasi')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setState({ ...options, resolve })
    })
  }, [])

  const handleConfirm = () => { state?.resolve(true);  setState(null) }
  const handleCancel  = () => { state?.resolve(false); setState(null) }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <ConfirmDialog {...state} onConfirm={handleConfirm} onCancel={handleCancel}/>
      )}
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)
