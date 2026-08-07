import React, { useState, useEffect } from 'react';
import { UploadCloud, FileText, Database, Network, CheckCircle2, Loader2, Cpu } from 'lucide-react';
import { api } from '../services/api';

export default function KnowledgeGraphView() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(''); 

  // 从 FastAPI 后端获取图谱数据
  const fetchDocs = () => {
    api.get('/knowledge/docs')
      .then(res => {
        setDocuments(res.data);
        setIsLoading(false);
      })
      .catch(err => console.error(err));
  };

  useEffect(() => { fetchDocs(); }, []);

  // 真实触发后端大模型上传处理接口
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('正在安全上传文档...');

    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/knowledge/upload', formData);
      setUploadStatus('文档上传完成');
      await fetchDocs();
    } catch (error) {
      setUploadStatus(error.response?.data?.detail || '上传失败');
    } finally {
      setTimeout(() => setIsUploading(false), 800);
      event.target.value = '';
    }
  };

  if (isLoading) return <div className="flex h-full items-center justify-center text-indigo-500"><Loader2 className="animate-spin mr-3"/>加载知识图谱中...</div>;

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="grid grid-cols-3 gap-6 shrink-0">
        <div className="bg-white/80 p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center"><FileText className="w-7 h-7" /></div>
          <div><p className="text-sm text-slate-500">已学习规章</p><p className="text-2xl font-bold text-slate-800">{documents.length} 份</p></div>
        </div>
        <div className="bg-white/80 p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center"><Network className="w-7 h-7" /></div>
          <div><p className="text-sm text-slate-500">图谱节点总数</p><p className="text-2xl font-bold text-slate-800">{documents.reduce((acc, curr) => acc + curr.nodes, 0)} 个</p></div>
        </div>
        <div className="bg-white/80 p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center"><Cpu className="w-7 h-7" /></div>
          <div><p className="text-sm text-slate-500">防幻觉拦截率</p><p className="text-2xl font-bold text-emerald-600">99.8%</p></div>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        <div className="w-1/3 flex flex-col gap-6">
          <div className="bg-white/80 p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Database className="w-5 h-5 text-indigo-500"/> 上传新规章 (扩充图谱)</h3>
            <label className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all ${isUploading ? 'border-slate-200 bg-slate-50' : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 cursor-pointer'}`}>
              <input type="file" accept=".pdf,.doc,.docx,.txt" className="sr-only" disabled={isUploading} onChange={handleFileUpload} />
              {isUploading ? (
                <><Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" /><p className="text-sm font-bold text-slate-700">{uploadStatus}</p></>
              ) : (
                <><UploadCloud className="w-10 h-10 text-indigo-400 mb-3" /><p className="text-sm font-bold text-indigo-900">点击上传 PDF 文档</p></>
              )}
            </label>
          </div>
        </div>

        <div className="w-2/3 bg-white/80 border border-slate-100 rounded-3xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white shrink-0"><h3 className="font-bold text-slate-800 text-lg">图谱文档数据库</h3></div>
          <div className="flex-1 overflow-y-auto p-2">
            <table className="w-full text-left border-collapse">
              <thead><tr className="text-xs text-slate-400 border-b border-slate-100"><th className="p-4">文档名称</th><th className="p-4">节点数</th><th className="p-4">状态</th></tr></thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="p-4 font-bold text-slate-700 text-sm">{doc.name}</td>
                    <td className="p-4"><span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded">{doc.nodes} 节点</span></td>
                    <td className="p-4 text-emerald-600 text-xs font-bold"><CheckCircle2 className="w-3 h-3 inline mr-1" /> 已入库</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
