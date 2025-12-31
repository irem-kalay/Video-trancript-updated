import React, { useState, useCallback, useRef, useEffect } from 'react';
import { VideoIcon, Upload, Download, Loader2, FileText, Sparkles, CheckCircle2, AlertCircle, Languages, Zap, Brain, Rocket, Gem, Activity, Menu, X, ChevronRight, TrendingUp } from 'lucide-react';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Progress } from './components/ui/progress';
import { Badge } from './components/ui/badge';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { motion, AnimatePresence } from 'motion/react';

// Translation object
const translations = {
  tr: {
    appName: "VideoSummarizer",
    subtitle: "Yapay Zeka ile Videolarınızı Anında Özetleyin",
    uploadLabel: "CSV Dosyası Yükle",
    dragDrop: "Dosyanızı buraya sürükleyin",
    uploadSuccess: "başarıyla yüklendi",
    aiModelLabel: "AI Model",
    startProcess: "Özetlemeyi Başlat",
    showTranscripts: "Transkript Al",
    processing: "İşleniyor",
    completed: "Tamamlandı",
    error: "Hata",
    download: "İndir",
    transcript: "Transkript",
    summary: "Özet",
    video: "Video",
    step1: "Dosya Yükle",
    step2: "Model Seç",
    step3: "İşlemi Başlat",
    howItWorks: "Nasıl Çalışır?",
    features: "Özellikler",
    fast: "Hızlı İşlem",
    accurate: "Yüksek Doğruluk",
    multiModel: "Çoklu Model",
    footerText: "© 2025 VideoSummarizer - AI ile güçlendirilmiştir"
  },
  en: {
    appName: "VideoSummarizer",
    subtitle: "Summarize Your Videos Instantly with AI",
    uploadLabel: "Upload CSV File",
    dragDrop: "Drag your file here",
    uploadSuccess: "uploaded successfully",
    aiModelLabel: "AI Model",
    startProcess: "Start Summarizing",
    showTranscripts: "Get Transcripts",
    processing: "Processing",
    completed: "Completed",
    error: "Error",
    download: "Download",
    transcript: "Transcript",
    summary: "Summary",
    video: "Video",
    step1: "Upload File",
    step2: "Select Model",
    step3: "Start Process",
    howItWorks: "How It Works?",
    features: "Features",
    fast: "Fast Processing",
    accurate: "High Accuracy",
    multiModel: "Multi-Model",
    footerText: "© 2025 VideoSummarizer - Powered by AI"
  },
};

// AI Models with more vibrant styling
const aiModels = [
  { 
    id: 'mistral', 
    name: 'Mistral', 
    icon: Brain, 
    gradient: 'from-purple-600 via-purple-500 to-pink-500',
    description: 'Balanced & Fast'
  },
  { 
    id: 'gpt', 
    name: 'GPT-4', 
    icon: Sparkles, 
    gradient: 'from-emerald-600 via-teal-500 to-cyan-500',
    description: 'Most Advanced'
  },
  { 
    id: 'deepseek', 
    name: 'Deepseek', 
    icon: Rocket, 
    gradient: 'from-blue-600 via-indigo-500 to-purple-500',
    description: 'Deep Analysis'
  },
  { 
    id: 'gemini', 
    name: 'Gemini', 
    icon: Gem, 
    gradient: 'from-orange-600 via-red-500 to-pink-500',
    description: 'Creative'
  },
  { 
    id: 'gemma', 
    name: 'Gemma', 
    icon: Zap, 
    gradient: 'from-violet-600 via-purple-500 to-fuchsia-500',
    description: 'Lightning Fast'
  },
];

interface ProcessedResult {
  url: string;
  video_id?: string;
  language?: string;
  transcript?: string;
  summary?: string;
  error?: string;
}

export default function App() {
  const [language, setLanguage] = useState<'tr' | 'en'>('tr');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedModel, setSelectedModel] = useState('mistral');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [transcriptResults, setTranscriptResults] = useState<ProcessedResult[]>([]);
  const [summaryResults, setSummaryResults] = useState<ProcessedResult[]>([]);
  const [currentView, setCurrentView] = useState<'idle' | 'transcripts' | 'summaries'>('idle');
  const [progressMessage, setProgressMessage] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[language];

  useEffect(() => {
    if (uploadedFile) setActiveStep(2);
  }, [uploadedFile]);

  // File upload handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      setUploadedFile(file);
      toast.success(`${file.name} ${t.uploadSuccess}`);
    } else {
      toast.error('Please upload a CSV file');
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      setUploadedFile(file);
      toast.success(`${file.name} ${t.uploadSuccess}`);
    } else {
      toast.error('Please upload a CSV file');
    }
  }, [t]);

  // Download handler
  const downloadTextFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // Process transcripts
  const handleShowTranscripts = async () => {
    if (!uploadedFile) {
      toast.error(t.uploadLabel);
      return;
    }

    setIsProcessing(true);
    setProgressMessage('Starting transcript extraction...');
    setCurrentView('transcripts');
    setShowResults(true);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const response = await fetch('http://127.0.0.1:5000/transcripts', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.status === 'ok' && data.results) {
        setTranscriptResults(data.results);
        toast.success(`${t.completed}! ${data.results.length} ${t.video}(s) processed`);
      } else {
        toast.error(data.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      toast.error(`Connection error: ${error.message}`);
      console.error('Fetch error:', error);
    } finally {
      setIsProcessing(false);
      setProgressMessage('');
    }
  };

  // Process summaries
  const handleProcessSummaries = async () => {
    if (!uploadedFile) {
      toast.error(t.uploadLabel);
      return;
    }

    setIsProcessing(true);
    setProgressMessage('Starting summarization process...');
    setCurrentView('summaries');
    setShowResults(true);

    const formData = new FormData();
    formData.append('file', uploadedFile);
    formData.append('aiModel', selectedModel);

    try {
      const response = await fetch('https://video-summarizer-backend-n4s2.onrender.com', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.status === 'completed' && data.results) {
        setSummaryResults(data.results);
        toast.success(`${t.completed}! ${data.results.length} ${t.video}(s) summarized`);
      } else {
        toast.error(data.error || 'Unknown error occurred');
      }
    } catch (error: any) {
      toast.error(`Connection error: ${error.message}`);
      console.error('Fetch error:', error);
    } finally {
      setIsProcessing(false);
      setProgressMessage('');
    }
  };

  const selectedModelData = aiModels.find(m => m.id === selectedModel);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white overflow-hidden">
      <Toaster position="top-center" />
      
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-0 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-0 -right-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute -bottom-40 left-1/2 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
          animate={{
            x: [0, 50, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-2xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur-lg opacity-75"></div>
                <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600">
                  <VideoIcon className="w-6 h-6 text-white" />
                </div>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {t.appName}
              </span>
            </motion.div>

            <div className="hidden md:flex items-center gap-4">
              <Button
                variant={language === 'tr' ? 'default' : 'ghost'}
                className={`h-12 px-4 text-3xl ${language === 'tr' ? 'bg-black/20 hover:bg-black/30' : 'hover:bg-white/10'}`}
                //className={`h-12 px-4 text-3xl ${language === 'tr' ? 'bg-white/10 hover:bg-white/20' : 'hover:bg-white/10'}`}
                onClick={() => setLanguage('tr')}
                //className={language === 'tr' ? 'bg-white/10 hover:bg-white/20' : 'hover:bg-white/10'}
              >
                🇹🇷
              </Button>
              <Button
                variant={language === 'en' ? 'default' : 'ghost'}
                className={`h-12 px-4 text-3xl ${language === 'tr' ? 'bg-white/10 hover:bg-white/20' : 'hover:bg-white/10'}`}
                onClick={() => setLanguage('en')}
                //className={language === 'en' ? 'bg-white/10 hover:bg-white/20' : 'hover:bg-white/10'}
              >
                🇬🇧
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="fixed top-16 left-0 right-0 z-40 bg-black/95 backdrop-blur-2xl border-b border-white/10"
          >
            <div className="p-4 space-y-2">
              <Button
                variant={language === 'tr' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setLanguage('tr')}
              >
                🇹🇷 Türkçe
              </Button>
              <Button
                variant={language === 'en' ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setLanguage('en')}
              >
                🇬🇧 English
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          
          {/* Hero Section */}
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, type: "spring" }}
              className="inline-block mb-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-50 animate-pulse"></div>
                <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-600 to-pink-600 shadow-2xl">
                  <VideoIcon className="w-14 h-14 text-white" />
                </div>
              </div>
            </motion.div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
              {t.appName}
            </h1>
            <p className="text-xl sm:text-2xl text-purple-300/80 max-w-3xl mx-auto">
              {t.subtitle}
            </p>

            {/* Feature badges */}
            <div className="flex flex-wrap justify-center gap-3 mt-8">
              <Badge className="px-6 py-3 text-lg bg-purple-500/20 border-purple-500/30 text-purple-300 backdrop-blur-xl">
                <Zap className="w-6 h-6 mr-3" />
                {t.fast}
              </Badge>
              <Badge className="px-6 py-3 text-lg bg-pink-500/20 border-pink-500/30 text-pink-300 backdrop-blur-xl">
                <TrendingUp className="w-6 h-6 mr-3" />
                {t.accurate}
              </Badge>
              <Badge className="px-6 py-3 text-lg bg-blue-500/20 border-blue-500/30 text-blue-300 backdrop-blur-xl">
                <Activity className="w-6 h-6 mr-3" />
                {t.multiModel}
              </Badge>
            </div>
          </motion.div>

          {/* Main Interface - 3-Step Flow */}
          <div className="grid lg:grid-cols-3 gap-6 mb-12">
            
            {/* Step 1: Upload */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className={`relative overflow-hidden bg-white/5 backdrop-blur-xl border-2 transition-all duration-300 ${
                activeStep === 1 ? 'border-purple-500 shadow-2xl shadow-purple-500/30' : 'border-white/10'
              }`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-transparent rounded-bl-full"></div>
                
                <div className="relative p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${
                      uploadedFile ? 'from-green-500 to-emerald-500' : 'from-purple-500 to-pink-500'
                    }`}>
                      {uploadedFile ? <CheckCircle2 className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                    </div>
                    <div>
                      <div className="text-xs text-purple-400 font-semibold">STEP 1</div>
                      <h3 className="font-bold text-lg text-white">{t.step1}</h3>
                    </div>
                  </div>

                  <div
                    className={`mt-4 border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
                      isDragging
                        ? 'border-purple-400 bg-purple-500/20'
                        : uploadedFile
                        ? 'border-green-400 bg-green-500/10'
                        : 'border-white/20 bg-white/5 hover:border-purple-400 hover:bg-purple-500/10'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    
                    {uploadedFile ? (
                      <div className="space-y-2">
                        <CheckCircle2 className="w-12 h-12 mx-auto text-green-400" />
                        <p className="font-semibold text-green-400 break-all">{uploadedFile.name}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-12 h-12 mx-auto text-purple-400" />
                        <p className="text-sm text-white">{t.dragDrop}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Step 2: Select Model */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card className={`relative overflow-hidden bg-white/5 backdrop-blur-xl border-2 transition-all duration-300 ${
                activeStep === 2 ? 'border-purple-500 shadow-2xl shadow-purple-500/30' : 'border-white/10'
              }`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-pink-500/20 to-transparent rounded-bl-full"></div>
                
                <div className="relative p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500">
                      <Brain className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs text-pink-400 font-semibold">STEP 2</div>
                      <h3 className="font-bold text-lg text-white">{t.step2}</h3>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {aiModels.map((model) => {
                      const Icon = model.icon;
                      return (
                        <motion.button
                          key={model.id}
                          onClick={() => {
                            setSelectedModel(model.id);
                            setActiveStep(3);
                          }}
                          className={`w-full p-3 rounded-xl border-2 transition-all duration-300 text-left ${
                            selectedModel === model.id
                              ? 'border-white/40 bg-white/10 shadow-lg'
                              : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                          }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${model.gradient}`}>
                              <Icon className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-white">{model.name}</p>
                              <p className="text-xs text-purple-300/60">{model.description}</p>
                            </div>
                            {selectedModel === model.id && (
                              <CheckCircle2 className="w-5 h-5 text-purple-400" />
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Step 3: Process */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Card className={`relative overflow-hidden bg-white/5 backdrop-blur-xl border-2 transition-all duration-300 ${
                activeStep === 3 ? 'border-purple-500 shadow-2xl shadow-purple-500/30' : 'border-white/10'
              }`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-bl-full"></div>
                
                <div className="relative p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500">
                      <Rocket className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs text-blue-400 font-semibold">STEP 3</div>
                      <h3 className="font-bold text-lg text-white">{t.step3}</h3>
                    </div>
                  </div>

                  {selectedModelData && (
                    <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-sm text-purple-300 mb-2">Selected Model:</div>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${selectedModelData.gradient}`}>
                          {React.createElement(selectedModelData.icon, { className: "w-6 h-6 text-white" })}
                        </div>
                        <div>
                          <p className="font-bold text-lg text-white">{selectedModelData.name}</p>
                          <p className="text-xs text-purple-300/60">{selectedModelData.description}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 space-y-3">
                    <Button
                      onClick={handleProcessSummaries}
                      disabled={!uploadedFile || isProcessing}
                      className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
                    >
                      {isProcessing && currentView === 'summaries' ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          {t.processing}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          {t.startProcess}
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={handleShowTranscripts}
                      disabled={!uploadedFile || isProcessing}
                      variant="outline"
                      className="w-full h-12 bg-white/5 border-white/20 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white"
                    >
                      {isProcessing && currentView === 'transcripts' ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          {t.processing}
                        </>
                      ) : (
                        <>
                          <FileText className="w-5 h-5 mr-2" />
                          {t.showTranscripts}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Processing Status */}
          <AnimatePresence>
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-12"
              >
                <Card className="bg-purple-500/10 backdrop-blur-xl border-purple-500/30 p-6">
                  <div className="flex items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
                    <div className="flex-1">
                      <p className="font-semibold text-lg text-purple-300">{t.processing}</p>
                      <p className="text-sm text-purple-400/60">{progressMessage}</p>
                    </div>
                  </div>
                  <Progress value={33} className="mt-4 h-2" />
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Section */}
          <AnimatePresence>
            {showResults && (currentView === 'transcripts' ? transcriptResults.length > 0 : summaryResults.length > 0) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-white/5 backdrop-blur-xl border-white/10">
                  <div className="p-6 border-b border-white/10">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      {currentView === 'transcripts' ? (
                        <>
                          <FileText className="w-6 h-6 text-blue-400" />
                          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                            Transcripts ({transcriptResults.length})
                          </span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-6 h-6 text-purple-400" />
                          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            Summaries ({summaryResults.length})
                          </span>
                        </>
                      )}
                    </h2>
                  </div>

                  <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
                    {(currentView === 'transcripts' ? transcriptResults : summaryResults).map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="group relative overflow-hidden rounded-xl bg-white/5 border border-white/10 p-5 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
                      >
                        {item.error ? (
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                            <div className="flex-1">
                              <p className="font-semibold text-red-300 mb-1">{t.video} {index + 1}</p>
                              <p className="text-sm text-purple-300/60 break-all mb-2">{item.url}</p>
                              <p className="text-sm text-red-400">{item.error}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                              <div className={`flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br flex-shrink-0 ${
                                currentView === 'transcripts' 
                                  ? 'from-blue-500 to-cyan-500' 
                                  : 'from-purple-500 to-pink-500'
                              }`}>
                                {currentView === 'transcripts' ? (
                                  <FileText className="w-6 h-6" />
                                ) : (
                                  <Sparkles className="w-6 h-6" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-lg mb-1">
                                  {t.video} {index + 1}
                                </p>
                                <p className="text-sm text-purple-300/60 truncate">{item.url}</p>
                                {item.language && (
                                  <Badge className="mt-2 bg-purple-500/20 border-purple-500/30 text-purple-300">
                                    <Languages className="w-3 h-3 mr-1" />
                                    {item.language}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              onClick={() => {
                                const content = currentView === 'transcripts' ? item.transcript : item.summary;
                                const type = currentView === 'transcripts' ? 'transcript' : 'summary';
                                const filename = item.url.replace(/[^a-z0-9]/gi, '_').substring(0, 50) + `_${type}.txt`;
                                downloadTextFile(content || 'No content available', filename);
                              }}
                              className={`flex-shrink-0 bg-gradient-to-r ${
                                currentView === 'transcripts'
                                  ? 'from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                                  : 'from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                              }`}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              {t.download}
                            </Button>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative mt-20 border-t border-white/10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-purple-300/60 text-sm">
              {t.footerText}
            </p>
            <p className="mt-2 text-purple-400/40 text-xs">
              Made with <span className="text-pink-500">♥</span> by AI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}