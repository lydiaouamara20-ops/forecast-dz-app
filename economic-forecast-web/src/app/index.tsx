import * as WebBrowser from 'expo-web-browser';
import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import React, { useMemo, useState } from 'react';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Screen =
  | 'login'
  | 'register'
  | 'dashboard'
  | 'automatic'
  | 'manual'
  | 'manualCategories'
  | 'manualModels'
  | 'history'
  | 'detail';

type Lang = 'en' | 'fr' | 'ar';
type ModelCategory = 'classical' | 'modern' | 'hybrid';
type StudyType = 'univariate' | 'multivariate';
type HybridGroupKey = 'hybridTT' | 'hybridTM' | 'hybridMM';
type IntegrationTarget = 'package' | 'fiddler' | 'datarobot';

type PickedFile = {
  name: string;
  uri: string;
  mimeType?: string | null;
  file?: File | null;
};

type BenchmarkEntry = {
  model: string;
  category: ModelCategory;
  subgroup?: HybridGroupKey;
  mae: number | null;
  rmse: number | null;
  mse: number | null;
  accuracy: number | null;
  score: number | null;
  rank: number | null;
};

type EstimationSummary = {
  equation: string;
  rSquared: number | null;
  aic: number | null;
  bic: number | null;
  variables: number | null;
  drivers: string[];
};

type Forecast = {
  id: string;
  name: string;
  model: string;
  date: string;
  accuracy: number | null;
  type: 'automatic' | 'manual';
  studyType: StudyType;
  horizon: number;
  dataPoints: number | null;
  fileName: string;
  predictions: number[];
  actualSeries: number[];
  predictedSeries: number[];
  metrics: {
    mae: number | null;
    rmse: number | null;
    mse: number | null;
  } | null;
  benchmarkSummary: BenchmarkEntry[];
  estimationSummary?: EstimationSummary | null;
  status: 'pending' | 'completed';
  message?: string;
  sector: string | null;
};

type RecommendationPattern = {
  name: string;
  detected: boolean;
  details: string;
};

type RecommendedModel = {
  model: string;
  reason: string;
};

type ManualRecommendationResult = {
  summary: string;
  detected_patterns: RecommendationPattern[];
  recommended_models: RecommendedModel[];
};

type ModelEntry = {
  model: string;
  category: ModelCategory;
  subgroup?: HybridGroupKey;
};

const palette = {
  navy: '#08243D',
  royal: '#0B63E5',
  sky: '#1FA5FF',
  gold: '#F4B400',
  green: '#18B368',
  teal: '#0EA5A4',
  bgSoft: '#F4F8FC',
  white: '#FFFFFF',
  textDark: '#11263A',
  textMuted: '#7B8A9A',
  border: '#DCE6F0',
  danger: '#E44D5E',
  purple: '#7C3AED',
};

const CLASSICAL_MODELS: string[] = [
  'Linear Regression',
  'Logistic Regression',
  'Moving Average',
  'Exponential Smoothing',
  'Holt',
  'Holt-Winters',
  'ETS',
  'AR',
  'MA',
  'ARMA',
  'ARIMA',
  'SARIMA',
  'VAR',
  'VECM',
  'VARMAX',
  'GARCH',
];

const MODERN_MODELS: string[] = [
  'Random Forest',
  'XGBoost',
  'LightGBM',
  'Support Vector Regression (SVR)',
  'MLP Regressor',
  'CNN for Time Series',
  'Simple RNN',
  'LSTM',
  'GRU',
  'Bidirectional LSTM',
  'Bidirectional GRU',
  'Transformers for Time Series Forecasting',
];

const HYBRID_GROUPS: Array<{ key: HybridGroupKey; models: string[] }> = [
  {
    key: 'hybridTT',
    models: [
      'ARIMA + GARCH',
      'SARIMA + GARCH',
      'STL + ARIMA',
      'VAR + GARCH',
    ],
  },
  {
    key: 'hybridTM',
    models: [
      'ARIMA-ANN',
      'ARIMA-LSTM',
      'ARIMA-SVR',
      'Prophet-XGBoost',
      'Fuzzy Logic + ARIMA',
      'Fuzzy Logic + LightGBM',
    ],
  },
  {
    key: 'hybridMM',
    models: [
      'ANFIS (Neuro-Fuzzy)',
      'FIG-LSTM',
      'CNN-LSTM',
      'LSTM-Transformer',
      'Transformer-BiLSTM',
      'Fuzzy Logic + LSTM',
      'Fuzzy Logic + GRU',
    ],
  },
];

const SECTORS: string[] = [
  'Finance / Banking',
  'Insurance',
  'Healthcare',
  'Pharmaceuticals',
  'Retail / Commerce',
  'Manufacturing',
  'Energy',
  'Telecommunications',
  'Transport / Logistics',
  'Agriculture',
  'Education',
  'Public Sector',
  'Technology',
  'Real Estate',
  'Tourism / Hospitality',
];

const copy = {
  en: {
    email: 'Email',
    password: 'Password',
    login: 'Login',
    createAccount: 'Create account',
    noAccount: "Don't have an account?",
    fullName: 'Full name',
    confirmPassword: 'Confirm password',
    register: 'Register',
    alreadyHaveAccount: 'Already have an account?',
    backToLogin: 'Back to login',
    chooseLanguage: 'Language',
    welcome: 'Welcome to Forecast DZ',
    chooseMode: 'Choose your forecasting mode',
    automaticForecast: 'Automatic Forecast',
    automaticDesc:
      'Benchmark all traditional, modern, and hybrid models automatically after real algorithms are implemented.',
    manualForecast: 'Manual Forecast',
    manualDesc:
      'Choose one model, while keeping comparison visible for the selected category.',
    recentForecasts: 'Recent forecasts',
    viewAll: 'View all',
    history: 'History',
    home: 'Home',
    uploadDataFile: 'Upload data file',
    chooseExcel: 'Choose Excel or CSV file',
    chooseFile: 'Choose file',
    runAuto: 'Run full automatic benchmarking',
    selectModel: 'Model library',
    applyModel: 'Apply model',
    runManual: 'Run selected model',
    forecastDetails: 'Forecast details',
    metrics: 'Performance metrics',
    delete: 'Delete',
    noForecasts: 'No saved forecasts',
    typeAutomatic: 'Automatic',
    typeManual: 'Manual',
    accuracy: 'Accuracy',
    file: 'File',
    model: 'Model',
    date: 'Date',
    type: 'Type',
    mse: 'MSE',
    requiredFields: 'Please enter email and password',
    registerSuccess: 'Account created successfully',
    registerFillAll: 'Please complete all fields',
    registerPasswordMismatch: 'Passwords do not match',
    fileChosen: 'File selected successfully',
    selectFileFirst: 'Please choose a file first',
    selectModelFirst: 'Please select a model first',
    settings: 'Settings',
    profile: 'Profile',
    notifications: 'Notifications',
    language: 'Language',
    theme: 'Theme',
    security: 'Security',
    help: 'Help & Support',
    about: 'About app',
    logout: 'Logout',
    pickerError: 'Unable to open file picker',
    noFileSelected: 'No file selected',
    modelCategories: 'Model Categories',
    chooseModel: 'Choose Model',
    traditionalModels: 'Traditional Models',
    modernModels: 'Modern Models',
    hybridModels: 'Hybrid Models',
    traditionalSubtitle: 'Classical statistical forecasting methods',
    modernSubtitle: 'Machine learning and deep learning models',
    hybridSubtitle:
      'Traditional + Traditional / Traditional + Modern / Modern + Modern',
    chooseCategory: 'Open model library',
    noMatchingModels: 'No matching models',
    pendingResults: 'Pending results',
    studyType: 'Study type',
    univariate: 'Univariate',
    multivariate: 'Multivariate',
    univariateInfo: 'Single series: upload file then forecast.',
    multivariateInfo: 'Multiple variables: estimation first, then forecasting.',
    forecastHorizon: 'Forecast horizon',
    periods: 'Periods',
    estimationStage: 'Estimation stage',
    runEstimation: 'Run estimation',
    estimationDone: 'Estimation completed',
    estimationRequired: 'Please run estimation first',
    benchmarkAllModels: 'Benchmark all models automatically',
    topModels: 'Top ranked models',
    actualVsPredicted: 'Actual vs predicted',
    benchmarkNote:
      'This version keeps results empty until real algorithms are implemented.',
    hybridTT: 'Hybrid Models: Traditional + Traditional',
    hybridTM: 'Hybrid Models: Traditional + Modern',
    hybridMM: 'Hybrid Models: Modern + Modern',
    estimationSummary: 'Estimation summary',
    study: 'Study',
    forecastOutput: 'Forecast output',
    selectHorizonFirst: 'Please choose the forecast horizon first',
    rankingWillAppear:
      'Real ranking will appear after implementing all model algorithms.',
    bestModelPending: 'Best model will appear after adding the algorithms.',
    noChartData:
      'Chart will appear after computing real actual and predicted values.',
    noForecastValues:
      'Forecast values will appear after implementing the forecasting algorithms.',
    chartPending: 'Chart pending',
    sectorTitle: 'Organization sector',
    chooseSector: 'Choose your sector',
    selectedSector: 'Selected sector',
    analysisDecisionTitle: 'Analysis, interpretation, and decision support',
    fiddlerTitle: 'Fiddler AI',
    fiddlerDesc: 'Use Fiddler AI for analysis and interpretation of results.',
    datarobotTitle: 'DataRobot',
    datarobotDesc: 'Use DataRobot for decision guidance based on results.',
    preparePackage: 'Prepare result package',
    sendToFiddler: 'Send to Fiddler AI',
    sendToDataRobot: 'Send to DataRobot',
    variables: 'Study variables',
    packagePreview: 'Prepared package preview',
    integrationPending:
      'Actual sending requires API keys and backend integration. This version prepares the payload only.',
    packagePrepared: 'The result package has been prepared successfully.',
    comparisonScope: 'Comparison scope',
    manualCompareNote:
      'In manual mode, comparison covers the models inside the selected category.',
    brandSubtitle: 'Economic Forecast App',
    ok: 'OK',
    success: 'Success',
    error: 'Error',
    info: 'Info',
    backendError: 'Backend error',
    datasetColumns: 'Dataset columns',
    targetColumn: 'Target column',
    dateColumnOptional: 'Date column (optional)',
    testSize: 'Test size',
    exampleSales: 'Example: sales',
    exampleDate: 'Example: date',
    manualRecommendationTitle: 'Smart recommendation',
    manualRecommendationDesc:
      'Analyze the uploaded data, detect patterns, and recommend the most suitable forecasting models.',
    analyzeRecommend: 'Analyze data and recommend models',
    patternsDetected: 'Detected patterns',
    yes: 'Yes',
    no: 'No',
    recommendedModels: 'Recommended models',
    chooseThisModel: 'Choose this model',
    whyTheseModels: 'Why these models?',
    enterTargetColumn: 'Please enter the target column name.',
    manualRecommendationFailed: 'Manual recommendation failed',
    automaticForecastFailed: 'Automatic forecast failed',
    manualForecastFailed: 'Manual forecast failed',
    univariateBackendOnly:
      'Backend phase 1 currently supports univariate forecasting only.',
    selectedModelMessage: 'Selected model',
    streamlitOpenError: 'Unable to open the Streamlit dashboard.',
    openStreamlitDashboard: 'Open Streamlit analytics dashboard',
    actual: 'Actual',
    predicted: 'Predicted',
    max: 'Max',
    min: 'Min',
    noData: 'No data',
    mainSeries: 'Main series',
    automaticForecastUnivariate: 'Automatic forecast - Univariate',
    automaticForecastMultivariate: 'Automatic forecast - Multivariate',
    manualForecastName: 'Manual forecast',
    algorithmsNotConnected:
      'Algorithms are not connected yet. MAE, RMSE, MSE, ranking, chart, and forecast values will appear after implementation.',
    forecastEmptyUntilAlgorithms:
      'Forecast results remain empty until the forecasting algorithms are implemented. Comparison is prepared for the selected category.',
    realBackendLoaded: 'Real backend result loaded successfully.',
   preparedForAnalysis: 'Prepared for analysis and interpretation.',
preparedForDecision: 'Prepared for decision guidance.',
preparedAsPackage: 'Prepared as a result package.',

integrationPlatform: 'Platform',
integrationPurpose: 'Purpose',
integrationStatus: 'Status',
decisionSupport: 'Decision support',
decisionSignal: 'Signal',
decisionRecommendation: 'Recommendation',
confidenceNote: 'Confidence note',
exportReport: 'Export report',
reportTitle: 'Forecast DZ Report',
reportExportFailed: 'Unable to export report.',
exportTxtReport: 'Export TXT report',
exportJsonReport: 'Export JSON report',
reportSaved: 'Report file prepared successfully.',
jsonReportTitle: 'Forecast DZ JSON Report',
exportPdfReport: 'Export PDF report',
pdfReportPrepared: 'PDF report prepared successfully.',
sectors: {
      'Finance / Banking': 'Finance / Banking',
      Insurance: 'Insurance',
      Healthcare: 'Healthcare',
      Pharmaceuticals: 'Pharmaceuticals',
      'Retail / Commerce': 'Retail / Commerce',
      Manufacturing: 'Manufacturing',
      Energy: 'Energy',
      Telecommunications: 'Telecommunications',
      'Transport / Logistics': 'Transport / Logistics',
      Agriculture: 'Agriculture',
      Education: 'Education',
      'Public Sector': 'Public Sector',
      Technology: 'Technology',
      'Real Estate': 'Real Estate',
            'Tourism / Hospitality': 'Tourism / Hospitality',
    },
  },
  fr: {
    email: 'E-mail',
    password: 'Mot de passe',
    login: 'Connexion',
    createAccount: 'Créer un compte',
    noAccount: "Vous n'avez pas de compte ?",
    fullName: 'Nom complet',
    confirmPassword: 'Confirmer le mot de passe',
    register: "S'inscrire",
    alreadyHaveAccount: 'Vous avez déjà un compte ?',
    backToLogin: 'Retour à la connexion',
    chooseLanguage: 'Langue',
    welcome: 'Bienvenue sur Forecast DZ',
    chooseMode: 'Choisissez votre mode de prévision',
    automaticForecast: 'Prévision automatique',
    automaticDesc:
      'Comparer tous les modèles traditionnels, modernes et hybrides après connexion des vrais algorithmes.',
    manualForecast: 'Prévision manuelle',
    manualDesc:
      'Choisir un modèle tout en gardant la comparaison visible pour la catégorie choisie.',
    recentForecasts: 'Prévisions récentes',
    viewAll: 'Voir tout',
    history: 'Historique',
    home: 'Accueil',
    uploadDataFile: 'Télécharger le fichier',
    chooseExcel: 'Choisissez un fichier Excel ou CSV',
    chooseFile: 'Choisir un fichier',
    runAuto: 'Lancer le benchmarking complet',
    selectModel: 'Bibliothèque des modèles',
    applyModel: 'Appliquer le modèle',
    runManual: 'Exécuter le modèle choisi',
    forecastDetails: 'Détails de la prévision',
    metrics: 'Indicateurs de performance',
    delete: 'Supprimer',
    noForecasts: 'Aucune prévision enregistrée',
    typeAutomatic: 'Automatique',
    typeManual: 'Manuelle',
    accuracy: 'Précision',
    file: 'Fichier',
    model: 'Modèle',
    date: 'Date',
    type: 'Type',
    mse: 'MSE',
    requiredFields: "Veuillez saisir l'e-mail et le mot de passe",
    registerSuccess: 'Compte créé avec succès',
    registerFillAll: 'Veuillez remplir tous les champs',
    registerPasswordMismatch: 'Les mots de passe ne correspondent pas',
    fileChosen: 'Fichier sélectionné avec succès',
    selectFileFirst: "Veuillez d'abord choisir un fichier",
    selectModelFirst: "Veuillez d'abord choisir un modèle",
    settings: 'Paramètres',
    profile: 'Profil',
    notifications: 'Notifications',
    language: 'Langue',
    theme: 'Thème',
    security: 'Sécurité',
    help: 'Aide et support',
    about: "À propos de l'application",
    logout: 'Déconnexion',
    pickerError: "Impossible d'ouvrir le sélecteur de fichiers",
    noFileSelected: 'Aucun fichier sélectionné',
    modelCategories: 'Catégories des modèles',
    chooseModel: 'Choisir le modèle',
    traditionalModels: 'Modèles traditionnels',
    modernModels: 'Modèles modernes',
    hybridModels: 'Modèles hybrides',
    traditionalSubtitle: 'Méthodes statistiques classiques',
    modernSubtitle: 'Apprentissage automatique et profond',
    hybridSubtitle:
      'Traditionnel + Traditionnel / Traditionnel + Moderne / Moderne + Moderne',
    chooseCategory: 'Ouvrir la bibliothèque',
    noMatchingModels: 'Aucun modèle correspondant',
    pendingResults: 'Résultats en attente',
    studyType: 'Type d’étude',
    univariate: 'Univariée',
    multivariate: 'Multivariée',
    univariateInfo: 'Série unique : fichier puis prévision.',
    multivariateInfo: 'Plusieurs variables : estimation puis prévision.',
    forecastHorizon: 'Horizon de prévision',
    periods: 'Périodes',
    estimationStage: "Étape d'estimation",
    runEstimation: "Lancer l'estimation",
    estimationDone: 'Estimation terminée',
    estimationRequired: "Veuillez d'abord lancer l'estimation",
    benchmarkAllModels: 'Comparer automatiquement tous les modèles',
    topModels: 'Meilleurs modèles classés',
    actualVsPredicted: 'Réel vs prédit',
    benchmarkNote:
      'Cette version laisse les résultats vides jusqu’à l’implémentation des vrais algorithmes.',
    hybridTT: 'Modèles hybrides : Traditionnel + Traditionnel',
    hybridTM: 'Modèles hybrides : Traditionnel + Moderne',
    hybridMM: 'Modèles hybrides : Moderne + Moderne',
    estimationSummary: "Résumé de l'estimation",
    study: 'Étude',
    forecastOutput: 'Sortie de prévision',
    selectHorizonFirst: "Veuillez d'abord choisir l’horizon",
    rankingWillAppear:
      'Le classement réel apparaîtra après l’implémentation des algorithmes.',
    bestModelPending: 'Le meilleur modèle apparaîtra après ajout des algorithmes.',
    noChartData:
      'Le graphique apparaîtra après calcul des valeurs réelles et prévues.',
    noForecastValues:
      'Les valeurs prévues apparaîtront après implémentation des algorithmes.',
    chartPending: 'Graphique en attente',
    sectorTitle: "Secteur de l'organisation",
    chooseSector: 'Choisir votre secteur',
    selectedSector: 'Secteur sélectionné',
    analysisDecisionTitle: 'Analyse, interprétation et aide à la décision',
    fiddlerTitle: 'Fiddler AI',
    fiddlerDesc: 'Utiliser Fiddler AI pour analyser et interpréter les résultats.',
    datarobotTitle: 'DataRobot',
    datarobotDesc: 'Utiliser DataRobot pour guider la décision selon les résultats.',
    preparePackage: 'Préparer le package de résultats',
    sendToFiddler: 'Envoyer à Fiddler AI',
    sendToDataRobot: 'Envoyer à DataRobot',
    variables: "Variables de l'étude",
    packagePreview: 'Aperçu du package préparé',
    integrationPending:
      "L'envoi réel nécessite des clés API et un backend. Cette version prépare seulement le payload.",
    packagePrepared: 'Le package des résultats a été préparé avec succès.',
    comparisonScope: 'Portée de la comparaison',
    manualCompareNote:
      'En mode manuel, la comparaison couvre les modèles de la catégorie choisie.',
    brandSubtitle: 'Application de prévision économique',
    ok: 'OK',
    success: 'Succès',
    error: 'Erreur',
    info: 'Info',
    backendError: 'Erreur backend',
    datasetColumns: 'Colonnes du jeu de données',
    targetColumn: 'Colonne cible',
    dateColumnOptional: 'Colonne de date (facultative)',
    testSize: "Taille de l'échantillon test",
    exampleSales: 'Exemple : sales',
    exampleDate: 'Exemple : date',
    manualRecommendationTitle: 'Recommandation intelligente',
    manualRecommendationDesc:
      'Analyser les données importées, détecter les tendances et recommander les modèles de prévision les plus adaptés.',
    analyzeRecommend: 'Analyser les données et recommander des modèles',
    patternsDetected: 'Tendances détectées',
    yes: 'Oui',
    no: 'Non',
    recommendedModels: 'Modèles recommandés',
    chooseThisModel: 'Choisir ce modèle',
    whyTheseModels: 'Pourquoi ces modèles ?',
    enterTargetColumn: 'Veuillez saisir le nom de la colonne cible.',
    manualRecommendationFailed: 'La recommandation manuelle a échoué',
    automaticForecastFailed: 'La prévision automatique a échoué',
    manualForecastFailed: 'La prévision manuelle a échoué',
    univariateBackendOnly:
      'La phase 1 du backend prend actuellement en charge uniquement la prévision univariée.',
    selectedModelMessage: 'Modèle sélectionné',
    streamlitOpenError: "Impossible d'ouvrir le tableau de bord Streamlit.",
    openStreamlitDashboard: 'Ouvrir le tableau de bord analytique Streamlit',
    actual: 'Réel',
    predicted: 'Prédit',
    max: 'Max',
    min: 'Min',
    noData: 'Aucune donnée',
    mainSeries: 'Série principale',
    automaticForecastUnivariate: 'Prévision automatique - Univariée',
    automaticForecastMultivariate: 'Prévision automatique - Multivariée',
    manualForecastName: 'Prévision manuelle',
    algorithmsNotConnected:
      'Les algorithmes ne sont pas encore connectés. MAE, RMSE, MSE, classement, graphique et valeurs prévues apparaîtront après implémentation.',
    forecastEmptyUntilAlgorithms:
      'Les résultats de prévision restent vides jusqu’à l’implémentation des algorithmes. La comparaison est préparée pour la catégorie sélectionnée.',
    realBackendLoaded: 'Résultat réel du backend chargé avec succès.',
preparedForAnalysis: "Préparé pour l'analyse et l'interprétation.",
preparedForDecision: "Préparé pour l'aide à la décision.",
preparedAsPackage: 'Préparé comme package de résultats.',

integrationPlatform: 'Plateforme',
integrationPurpose: 'Objectif',
integrationStatus: 'Statut',
decisionSupport: 'Aide à la décision',
decisionSignal: 'Signal',
decisionRecommendation: 'Recommandation',
confidenceNote: 'Note de confiance',
exportReport: 'Exporter le rapport',
reportTitle: 'Rapport Forecast DZ',
reportExportFailed: "Impossible d'exporter le rapport.",
exportTxtReport: 'Exporter le rapport TXT',
exportJsonReport: 'Exporter le rapport JSON',
reportSaved: 'Le fichier du rapport a été préparé avec succès.',
jsonReportTitle: 'Rapport JSON Forecast DZ',
exportPdfReport: 'Exporter le rapport PDF',
pdfReportPrepared: 'Le rapport PDF a été préparé avec succès.',
sectors: {
      'Finance / Banking': 'Finance / Banque',
      Insurance: 'Assurance',
      Healthcare: 'Santé',
      Pharmaceuticals: 'Produits pharmaceutiques',
      'Retail / Commerce': 'Commerce / Distribution',
      Manufacturing: 'Industrie manufacturière',
      Energy: 'Énergie',
      Telecommunications: 'Télécommunications',
      'Transport / Logistics': 'Transport / Logistique',
      Agriculture: 'Agriculture',
      Education: 'Éducation',
      'Public Sector': 'Secteur public',
      Technology: 'Technologie',
      'Real Estate': 'Immobilier',
      'Tourism / Hospitality': 'Tourisme / Hôtellerie',
    },
  },
  ar: {
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    login: 'تسجيل الدخول',
    createAccount: 'إنشاء حساب',
    noAccount: 'ليس لديك حساب؟',
    fullName: 'الاسم الكامل',
    confirmPassword: 'تأكيد كلمة المرور',
    register: 'التسجيل',
    alreadyHaveAccount: 'لديك حساب بالفعل؟',
    backToLogin: 'العودة إلى تسجيل الدخول',
    chooseLanguage: 'اللغة',
    welcome: 'مرحبًا بك في Forecast DZ',
    chooseMode: 'اختر نمط التنبؤ المناسب',
    automaticForecast: 'التنبؤ التلقائي',
    automaticDesc:
      'اختبار جميع النماذج التقليدية والحديثة والهجينة تلقائيًا بعد ربط الخوارزميات الحقيقية.',
    manualForecast: 'التنبؤ اليدوي',
    manualDesc:
      'اختيار نموذج واحد مع إبقاء المقارنة ظاهرة داخل الفئة المختارة.',
    recentForecasts: 'التنبؤات الأخيرة',
    viewAll: 'عرض الكل',
    history: 'السجل',
    home: 'الرئيسية',
    uploadDataFile: 'رفع ملف البيانات',
    chooseExcel: 'اختر ملف Excel أو CSV',
    chooseFile: 'اختيار ملف',
    runAuto: 'تشغيل المقارنة التلقائية الكاملة',
    selectModel: 'مكتبة النماذج',
    applyModel: 'تطبيق النموذج',
    runManual: 'تشغيل النموذج المختار',
    forecastDetails: 'تفاصيل التنبؤ',
    metrics: 'مقاييس الأداء',
    delete: 'حذف',
    noForecasts: 'لا توجد تنبؤات محفوظة',
    typeAutomatic: 'تلقائي',
    typeManual: 'يدوي',
    accuracy: 'الدقة',
    file: 'الملف',
    model: 'النموذج',
    date: 'التاريخ',
    type: 'النوع',
    mse: 'MSE',
    requiredFields: 'يرجى إدخال البريد الإلكتروني وكلمة المرور',
    registerSuccess: 'تم إنشاء الحساب بنجاح',
    registerFillAll: 'يرجى ملء جميع الحقول',
    registerPasswordMismatch: 'كلمتا المرور غير متطابقتين',
    fileChosen: 'تم اختيار الملف بنجاح',
    selectFileFirst: 'يرجى اختيار ملف أولًا',
    selectModelFirst: 'يرجى اختيار نموذج أولًا',
    settings: 'الإعدادات',
    profile: 'الملف الشخصي',
    notifications: 'الإشعارات',
    language: 'اللغة',
    theme: 'السمة',
    security: 'الأمان',
    help: 'المساعدة والدعم',
    about: 'حول التطبيق',
    logout: 'تسجيل الخروج',
    pickerError: 'تعذر فتح نافذة اختيار الملفات',
    noFileSelected: 'لم يتم اختيار أي ملف',
    modelCategories: 'فئات النماذج',
    chooseModel: 'اختر النموذج',
    traditionalModels: 'النماذج التقليدية',
    modernModels: 'النماذج الحديثة',
    hybridModels: 'النماذج الهجينة',
    traditionalSubtitle: 'طرق إحصائية كلاسيكية للتنبؤ',
    modernSubtitle: 'نماذج تعلم آلي وتعلم عميق',
    hybridSubtitle: 'تقليدية + تقليدية / تقليدية + حديثة / حديثة + حديثة',
    chooseCategory: 'فتح مكتبة النماذج',
    noMatchingModels: 'لا توجد نماذج مطابقة',
    pendingResults: 'النتائج قيد الانتظار',
    studyType: 'نوع الدراسة',
    univariate: 'أحادية المتغير',
    multivariate: 'متعددة المتغيرات',
    univariateInfo: 'سلسلة واحدة: ارفع الملف ثم شغّل التنبؤ.',
    multivariateInfo: 'عدة متغيرات: مرحلة التقدير أولًا ثم التنبؤ.',
    forecastHorizon: 'أفق التنبؤ',
    periods: 'فترات',
    estimationStage: 'مرحلة التقدير',
    runEstimation: 'تشغيل التقدير',
    estimationDone: 'اكتمل التقدير',
    estimationRequired: 'يرجى تشغيل التقدير أولًا',
    benchmarkAllModels: 'مقارنة جميع النماذج تلقائيًا',
    topModels: 'أفضل النماذج مرتبة',
    actualVsPredicted: 'القيم الفعلية والمتنبأ بها',
    benchmarkNote:
      'هذه النسخة تبقي النتائج فارغة إلى أن يتم تنفيذ الخوارزميات الحقيقية.',
    hybridTT: 'النماذج الهجينة: تقليدية + تقليدية',
    hybridTM: 'النماذج الهجينة: تقليدية + حديثة',
    hybridMM: 'النماذج الهجينة: حديثة + حديثة',
    estimationSummary: 'ملخص التقدير',
    study: 'الدراسة',
    forecastOutput: 'مخرجات التنبؤ',
    selectHorizonFirst: 'يرجى تحديد أفق التنبؤ أولًا',
    rankingWillAppear:
      'سيظهر الترتيب الحقيقي بعد تنفيذ خوارزميات جميع النماذج.',
    bestModelPending: 'سيظهر أفضل نموذج بعد إضافة الخوارزميات.',
    noChartData:
      'سيظهر الرسم البياني بعد حساب القيم الفعلية والمتنبأ بها.',
    noForecastValues:
      'ستظهر قيم التنبؤ بعد تنفيذ خوارزميات التنبؤ.',
    chartPending: 'الرسم البياني قيد الانتظار',
    sectorTitle: 'قطاع المؤسسة',
    chooseSector: 'اختر قطاع المؤسسة',
    selectedSector: 'القطاع المختار',
    analysisDecisionTitle: 'التحليل والتفسير ودعم القرار',
    fiddlerTitle: 'Fiddler AI',
    fiddlerDesc: 'استخدم Fiddler AI لتحليل النتائج وتفسيرها.',
    datarobotTitle: 'DataRobot',
    datarobotDesc: 'استخدم DataRobot لتوجيه القرار بناءً على النتائج.',
    preparePackage: 'تجهيز حزمة النتائج',
    sendToFiddler: 'إرسال إلى Fiddler AI',
    sendToDataRobot: 'إرسال إلى DataRobot',
    variables: 'متغيرات الدراسة',
    packagePreview: 'معاينة الحزمة الجاهزة',
    integrationPending:
      'الإرسال الفعلي يحتاج إلى مفاتيح API وربط Backend. هذه النسخة تجهّز الحمولة فقط.',
    packagePrepared: 'تم تجهيز حزمة النتائج بنجاح.',
    comparisonScope: 'نطاق المقارنة',
    manualCompareNote:
      'في الوضع اليدوي، تغطي المقارنة النماذج الموجودة داخل الفئة المختارة.',
    brandSubtitle: 'تطبيق التنبؤ الاقتصادي',
    ok: 'موافق',
    success: 'نجاح',
    error: 'خطأ',
    info: 'معلومة',
    backendError: 'خطأ في الخادم',
    datasetColumns: 'أعمدة مجموعة البيانات',
    targetColumn: 'العمود الهدف',
    dateColumnOptional: 'عمود التاريخ (اختياري)',
    testSize: 'حجم عينة الاختبار',
    exampleSales: 'مثال: sales',
    exampleDate: 'مثال: date',
    manualRecommendationTitle: 'توصية ذكية',
    manualRecommendationDesc:
      'تحليل البيانات المرفوعة، اكتشاف الأنماط، واقتراح أنسب نماذج التنبؤ.',
    analyzeRecommend: 'تحليل البيانات واقتراح النماذج',
    patternsDetected: 'الأنماط المكتشفة',
    yes: 'نعم',
    no: 'لا',
    recommendedModels: 'النماذج المقترحة',
    chooseThisModel: 'اختيار هذا النموذج',
    whyTheseModels: 'لماذا هذه النماذج؟',
    enterTargetColumn: 'يرجى إدخال اسم العمود الهدف.',
    manualRecommendationFailed: 'فشلت التوصية اليدوية',
    automaticForecastFailed: 'فشل التنبؤ التلقائي',
    manualForecastFailed: 'فشل التنبؤ اليدوي',
    univariateBackendOnly:
      'المرحلة الأولى من الخادم تدعم حاليًا التنبؤ أحادي المتغير فقط.',
    selectedModelMessage: 'النموذج المختار',
    streamlitOpenError: 'تعذر فتح لوحة Streamlit التحليلية.',
    openStreamlitDashboard: 'فتح لوحة Streamlit التحليلية',
    actual: 'فعلي',
    predicted: 'متنبأ به',
    max: 'الأعلى',
    min: 'الأدنى',
    noData: 'لا توجد بيانات',
    mainSeries: 'السلسلة الرئيسية',
    automaticForecastUnivariate: 'تنبؤ تلقائي - أحادي المتغير',
    automaticForecastMultivariate: 'تنبؤ تلقائي - متعدد المتغيرات',
    manualForecastName: 'تنبؤ يدوي',
    algorithmsNotConnected:
      'الخوارزميات غير مربوطة بعد. ستظهر MAE وRMSE وMSE والترتيب والرسم البياني وقيم التنبؤ بعد التنفيذ.',
    forecastEmptyUntilAlgorithms:
      'تبقى نتائج التنبؤ فارغة إلى أن يتم تنفيذ خوارزميات التنبؤ. تم تجهيز المقارنة للفئة المختارة.',
    realBackendLoaded: 'تم تحميل نتيجة الخادم الحقيقية بنجاح.',
    preparedForAnalysis: 'مجهز للتحليل والتفسير.',
preparedForDecision: 'مجهز لدعم اتخاذ القرار.',
preparedAsPackage: 'مجهز كحزمة نتائج.',

integrationPlatform: 'المنصة',
integrationPurpose: 'الغرض',
integrationStatus: 'الحالة',
decisionSupport: 'دعم القرار',
decisionSignal: 'إشارة القرار',
decisionRecommendation: 'التوصية',
confidenceNote: 'ملاحظة الثقة',
exportReport: 'تصدير التقرير',
reportTitle: 'تقرير Forecast DZ',
reportExportFailed: 'تعذر تصدير التقرير.',
exportTxtReport: 'تصدير تقرير TXT',
exportJsonReport: 'تصدير تقرير JSON',
reportSaved: 'تم تجهيز ملف التقرير بنجاح.',
jsonReportTitle: 'تقرير Forecast DZ بصيغة JSON',
exportPdfReport: 'تصدير تقرير PDF',
pdfReportPrepared: 'تم تجهيز تقرير PDF بنجاح.',
sectors: {
      'Finance / Banking': 'المالية / البنوك',
      Insurance: 'التأمين',
      Healthcare: 'الرعاية الصحية',
      Pharmaceuticals: 'الصناعات الدوائية',
      'Retail / Commerce': 'التجزئة / التجارة',
      Manufacturing: 'الصناعة',
      Energy: 'الطاقة',
      Telecommunications: 'الاتصالات',
      'Transport / Logistics': 'النقل / الخدمات اللوجستية',
      Agriculture: 'الزراعة',
      Education: 'التعليم',
      'Public Sector': 'القطاع العام',
      Technology: 'التكنولوجيا',
      'Real Estate': 'العقارات',
      'Tourism / Hospitality': 'السياحة / الضيافة',
    },
  },
};

const BACKEND_BASE_URL = Platform.select({
  web: 'http://127.0.0.1:8000',
  default: 'http://192.168.0.126:8000',
})!;

function toNullableNumber(value: any): number | null {
  return typeof value === 'number' && !Number.isNaN(value) ? value : null;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function makeId(): string {
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString();
}

function parseHorizon(value: string): number | null {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

function getAllModelEntries(): ModelEntry[] {
  return [
    ...CLASSICAL_MODELS.map(
      (model): ModelEntry => ({
        model,
                category: 'classical',
        subgroup: undefined,
      })
    ),
    ...MODERN_MODELS.map(
      (model): ModelEntry => ({
        model,
        category: 'modern',
        subgroup: undefined,
      })
    ),
    ...HYBRID_GROUPS.flatMap((group) =>
      group.models.map(
        (model): ModelEntry => ({
          model,
          category: 'hybrid',
          subgroup: group.key,
        })
      )
    ),
  ];
}

function findModelMeta(model: string): ModelEntry {
  const found = getAllModelEntries().find((entry) => entry.model === model);
  return (
    found ?? {
      model,
      category: 'modern',
      subgroup: undefined,
    }
  );
}

function getCategoryLabel(category: ModelCategory, t: typeof copy.en): string {
  if (category === 'classical') return t.traditionalModels;
  if (category === 'modern') return t.modernModels;
  return t.hybridModels;
}

function getHybridGroupLabel(key: HybridGroupKey, t: typeof copy.en): string {
  if (key === 'hybridTT') return t.hybridTT;
  if (key === 'hybridTM') return t.hybridTM;
  return t.hybridMM;
}

function getSectorLabel(sector: string | null, t: typeof copy.en): string {
  if (!sector) return '';
  return (t.sectors as Record<string, string>)[sector] ?? sector;
}

function getForecastDisplayName(forecast: Forecast, t: typeof copy.en): string {
  if (forecast.type === 'automatic') {
    return forecast.studyType === 'univariate'
      ? t.automaticForecastUnivariate
      : t.automaticForecastMultivariate;
  }

  if (forecast.type === 'manual') {
    return forecast.model && forecast.model !== '—'
      ? `${t.manualForecastName} - ${forecast.model}`
      : t.manualForecastName;
  }

  return forecast.name;
}

function getForecastDisplayMessage(forecast: Forecast, t: typeof copy.en): string {
  if (forecast.status === 'pending' && forecast.type === 'automatic') {
    return t.algorithmsNotConnected;
  }

  if (forecast.status === 'pending' && forecast.type === 'manual') {
    return t.forecastEmptyUntilAlgorithms;
  }

  if (forecast.status === 'completed') {
    return t.realBackendLoaded;
  }

  return forecast.message ?? '';
}

function simulateEstimation(studyType: StudyType): EstimationSummary | null {
  if (studyType !== 'multivariate') return null;

  return {
    equation: 'Y = b0 + b1X1 + b2X2 + b3X3 + ε',
    rSquared: null,
    aic: null,
    bic: null,
    variables: 3,
    drivers: ['X1', 'X2', 'X3'],
  };
}

function getStudyVariables(forecast: Forecast, t: typeof copy.en): string[] {
  if (forecast.studyType === 'univariate') return [t.mainSeries];
  if (forecast.estimationSummary?.drivers?.length) {
    return forecast.estimationSummary.drivers;
  }
  return ['X1', 'X2', 'X3'];
}

function createEmptyBenchmarkList(): BenchmarkEntry[] {
  return getAllModelEntries().map((entry) => ({
    model: entry.model,
    category: entry.category,
    subgroup: entry.subgroup,
    mae: null,
    rmse: null,
    mse: null,
    accuracy: null,
    score: null,
    rank: null,
  }));
}

function createManualComparisonList(
  selectedCategory: ModelCategory | null,
  selectedModel: string | null
): BenchmarkEntry[] {
  if (selectedCategory === 'classical') {
    return CLASSICAL_MODELS.map((model) => ({
      model,
      category: 'classical' as const,
      subgroup: undefined,
      mae: null,
      rmse: null,
      mse: null,
      accuracy: null,
      score: null,
      rank: null,
    }));
  }

  if (selectedCategory === 'modern') {
    return MODERN_MODELS.map((model) => ({
      model,
      category: 'modern' as const,
      subgroup: undefined,
      mae: null,
      rmse: null,
      mse: null,
      accuracy: null,
      score: null,
      rank: null,
    }));
  }

  if (selectedCategory === 'hybrid') {
    return HYBRID_GROUPS.flatMap((group) =>
      group.models.map((model) => ({
        model,
        category: 'hybrid' as const,
        subgroup: group.key,
        mae: null,
        rmse: null,
        mse: null,
        accuracy: null,
        score: null,
        rank: null,
      }))
    );
  }

  if (selectedModel) {
    const meta = findModelMeta(selectedModel);
    return [
      {
        model: selectedModel,
        category: meta.category,
        subgroup: meta.subgroup,
        mae: null,
        rmse: null,
        mse: null,
        accuracy: null,
        score: null,
        rank: null,
      },
    ];
  }

  return [];
}

function mapRankingToBenchmark(ranking: any[]): BenchmarkEntry[] {
  return (ranking || []).map((item, index) => {
    const meta = findModelMeta(item.model);
    return {
      model: item.model,
      category: meta.category,
      subgroup: meta.subgroup,
      mae: toNullableNumber(item.mae),
      rmse: toNullableNumber(item.rmse),
      mse: toNullableNumber(item.mse),
      accuracy: null,
      score: null,
      rank: index + 1,
    };
  });
}

function buildPendingAutomaticForecast(
  fileName: string,
  studyType: StudyType,
  horizon: number,
  estimationSummary?: EstimationSummary | null
): Forecast {
  return {
    id: makeId(),
    name:
      studyType === 'univariate'
        ? 'Automatic Forecast - Univariate'
        : 'Automatic Forecast - Multivariate',
    model: '—',
    date: today(),
    accuracy: null,
    type: 'automatic',
    studyType,
    horizon,
    dataPoints: null,
    fileName,
    predictions: [],
    actualSeries: [],
    predictedSeries: [],
    metrics: {
      mae: null,
      rmse: null,
      mse: null,
    },
    benchmarkSummary: createEmptyBenchmarkList(),
    estimationSummary: estimationSummary ?? null,
    status: 'pending',
    message:
      'Algorithms are not connected yet. MAE, RMSE, MSE, ranking, chart, and forecast values will appear after implementation.',
    sector: null,
  };
}

function buildPendingManualForecast(
  fileName: string,
  studyType: StudyType,
  horizon: number,
  model: string,
  selectedCategory: ModelCategory | null,
  estimationSummary?: EstimationSummary | null
): Forecast {
  return {
    id: makeId(),
    name: `Manual Forecast - ${model}`,
    model,
    date: today(),
    accuracy: null,
    type: 'manual',
    studyType,
    horizon,
    dataPoints: null,
    fileName,
    predictions: [],
    actualSeries: [],
    predictedSeries: [],
    metrics: {
      mae: null,
      rmse: null,
      mse: null,
    },
    benchmarkSummary: createManualComparisonList(selectedCategory, model),
    estimationSummary: estimationSummary ?? null,
    status: 'pending',
    message:
      'Forecast results remain empty until the forecasting algorithms are implemented. Comparison is prepared for the selected category.',
    sector: null,
  };
}

async function readFileAsBase64(file: PickedFile): Promise<string> {
  if (Platform.OS === 'web' && file.file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Unable to read file on web.'));
          return;
        }

        const base64 = result.split(',')[1];
        if (!base64) {
          reject(new Error('Invalid base64 content.'));
          return;
        }

        resolve(base64);
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file on web.'));
      };

      reader.readAsDataURL(file.file as File);
    });
  }

  return FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

async function postToBackend(path: string, payload: any) {
  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.detail || 'Backend request failed');
  }

  return data;
}

function buildForecastFromBackend(params: {
  data: any;
  type: 'automatic' | 'manual';
  studyType: StudyType;
  horizon: number;
  fileName: string;
  fallbackModel?: string | null;
}): Forecast {
  const { data, type, studyType, horizon, fileName, fallbackModel } = params;

  return {
    id: makeId(),
    name:
      type === 'automatic'
        ? `Automatic Forecast - ${data.best_model ?? 'Result'}`
        : `Manual Forecast - ${data.selected_model ?? fallbackModel ?? 'Result'}`,
    model: data.best_model ?? data.selected_model ?? fallbackModel ?? '—',
    date: today(),
    accuracy: null,
    type,
    studyType,
    horizon,
    dataPoints: Array.isArray(data.actual_series) ? data.actual_series.length : null,
    fileName,
    predictions: Array.isArray(data.future_predictions) ? data.future_predictions : [],
    actualSeries: Array.isArray(data.actual_series) ? data.actual_series : [],
    predictedSeries: Array.isArray(data.predicted_series) ? data.predicted_series : [],
    metrics: {
      mae: toNullableNumber(data?.metrics?.mae),
      rmse: toNullableNumber(data?.metrics?.rmse),
      mse: toNullableNumber(data?.metrics?.mse),
    },
    benchmarkSummary: mapRankingToBenchmark(data.ranking || []),
    estimationSummary: null,
    status: 'completed',
    message: 'Real backend result loaded successfully.',
    sector: null,
  };
}
function renderForecastChart(
  actualSeries: number[],
  predictedSeries: number[],
  t: typeof copy.en
) {
  if (!actualSeries.length || !predictedSeries.length) {
    return null;
  }

  const width = 320;
  const height = 180;
  const padding = 24;

  const maxLength = Math.max(actualSeries.length, predictedSeries.length);
  const allValues = [...actualSeries, ...predictedSeries];
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const range = maxValue - minValue || 1;

  const xStep = (width - padding * 2) / Math.max(maxLength - 1, 1);

  const toPoints = (series: number[]) =>
    series
      .map((value, index) => {
        const x = padding + index * xStep;
        const y =
          height - padding - ((value - minValue) / range) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');

  const actualPoints = toPoints(actualSeries);
  const predictedPoints = toPoints(predictedSeries);

  return (
    <View style={styles.chartCard}>
      <Svg width={width} height={height}>
        <Line
          x1={padding}
          y1={height - padding}
                    x2={width - padding}
          y2={height - padding}
          stroke="#94A3B8"
          strokeWidth="1"
        />
        <Line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#94A3B8"
          strokeWidth="1"
        />

        <Polyline
          points={actualPoints}
          fill="none"
          stroke="#0B63E5"
          strokeWidth="3"
        />
        <Polyline
          points={predictedPoints}
          fill="none"
          stroke="#18B368"
          strokeWidth="3"
        />

        <SvgText x={padding} y={16} fontSize="10" fill="#64748B">
          {t.max}: {maxValue.toFixed(2)}
        </SvgText>
        <SvgText x={padding} y={height - 6} fontSize="10" fill="#64748B">
          {t.min}: {minValue.toFixed(2)}
        </SvgText>
      </Svg>

      <View style={styles.chartLegendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#0B63E5' }]} />
          <Text style={styles.legendText}>{t.actual}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#18B368' }]} />
          <Text style={styles.legendText}>{t.predicted}</Text>
        </View>
      </View>
    </View>
  );
}
function SettingsModal({
  visible,
  onClose,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  t: typeof copy.en;
}) {
  const items = [
    { icon: 'person-outline', label: t.profile },
    { icon: 'notifications-none', label: t.notifications },
    { icon: 'language', label: t.language },
    { icon: 'palette', label: t.theme },
    { icon: 'security', label: t.security },
    { icon: 'help-outline', label: t.help },
    { icon: 'info-outline', label: t.about },
    { icon: 'logout', label: t.logout },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t.settings}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={palette.textDark} />
            </TouchableOpacity>
          </View>

          {items.map((item, index) => (
            <TouchableOpacity
              key={`${item.label}-${index}`}
              style={styles.settingsItem}
              onPress={() => Alert.alert(item.label)}
            >
              <View style={styles.settingsItemLeft}>
                <View style={styles.iconBox}>
                  <MaterialIcons name={item.icon as never} size={22} color={palette.royal} />
                </View>
                <Text style={styles.settingsItemText}>{item.label}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={palette.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function SectorSelectorModal({
  visible,
  onClose,
  onSelect,
  title,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (sector: string) => void;
  title: string;
  t: typeof copy.en;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={palette.textDark} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {SECTORS.map((sector) => (
              <TouchableOpacity
                key={sector}
                style={styles.sectorItem}
                onPress={() => {
                  onSelect(sector);
                  onClose();
                }}
              >
                <Text style={styles.sectorItemText}>{getSectorLabel(sector, t)}</Text>
                <MaterialIcons name="chevron-right" size={22} color={palette.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  return <View style={styles.nativeShell}>{children}</View>;
}

export default function Index() {
 const STREAMLIT_URL = 'http://10.2.0.2:8501';

const openAnalyticsDashboard = async () => {
  try {
    console.log('OPENING STREAMLIT:', STREAMLIT_URL);
    await Linking.openURL(STREAMLIT_URL);
  } catch (error) {
    console.log('STREAMLIT OPEN ERROR:', error);
    Alert.alert(copy.en.error, copy.en.streamlitOpenError);
  }
};
  const [screen, setScreen] = useState<Screen>('login');
  const [language, setLanguage] = useState<Lang>('en');
  const isRTL = language === 'ar';
  const textDirectionStyle = isRTL ? styles.rtlText : styles.ltrText;
  const rowDirectionStyle = isRTL ? styles.rtlRow : styles.ltrRow;
  const [showSettings, setShowSettings] = useState(false);
  const [showSectorModal, setShowSectorModal] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);

  const [fullName, setFullName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [selectedForecast, setSelectedForecast] = useState<Forecast | null>(null);

  const [autoStudyType, setAutoStudyType] = useState<StudyType>('univariate');
  const [autoFile, setAutoFile] = useState<PickedFile | null>(null);
  const [autoHorizon, setAutoHorizon] = useState('6');
  const [autoTargetColumn, setAutoTargetColumn] = useState('');
  const [autoDateColumn, setAutoDateColumn] = useState('');
  const [autoTestSize, setAutoTestSize] = useState('6');
  const [autoEstimating, setAutoEstimating] = useState(false);
  const [autoProcessing, setAutoProcessing] = useState(false);
  const [autoEstimationDone, setAutoEstimationDone] = useState(false);
  const [autoEstimationSummary, setAutoEstimationSummary] =
    useState<EstimationSummary | null>(null);

  const [manualStudyType, setManualStudyType] = useState<StudyType>('univariate');
  const [manualFile, setManualFile] = useState<PickedFile | null>(null);
  const [manualHorizon, setManualHorizon] = useState('6');
  const [manualTargetColumn, setManualTargetColumn] = useState('');
  const [manualDateColumn, setManualDateColumn] = useState('');
  const [manualTestSize, setManualTestSize] = useState('6');
  const [manualEstimating, setManualEstimating] = useState(false);
  const [manualProcessing, setManualProcessing] = useState(false);
  const [manualEstimationDone, setManualEstimationDone] = useState(false);
  const [manualEstimationSummary, setManualEstimationSummary] =
    useState<EstimationSummary | null>(null);
  const [manualRecommendationLoading, setManualRecommendationLoading] = useState(false);
  const [manualRecommendation, setManualRecommendation] =
  useState<ManualRecommendationResult | null>(null);  
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ModelCategory | null>(null);
  const [modelSearch, setModelSearch] = useState('');

  const [integrationPreview, setIntegrationPreview] = useState('');
const [integrationTarget, setIntegrationTarget] =
  useState<IntegrationTarget | null>(null);
const [integrationResult, setIntegrationResult] = useState<any | null>(null);

  const t = useMemo(() => copy[language], [language]);
  const latestForecasts = useMemo(() => forecasts.slice(0, 3), [forecasts]);

  const pickDocument = async (target: 'auto' | 'manual') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) {
        Alert.alert(t.info, t.noFileSelected);
        return;
      }

      const picked: PickedFile = {
        name: asset.name ?? 'selected-file',
        uri: asset.uri,
        mimeType: asset.mimeType ?? null,
        file: (asset as any).file ?? null,
      };

    if (target === 'auto') {
  setAutoFile(picked);
  if (autoStudyType === 'univariate') {
    setAutoEstimationDone(false);
    setAutoEstimationSummary(null);
  }
} else {
  setManualFile(picked);
  setManualRecommendation(null);
  if (manualStudyType === 'univariate') {
    setManualEstimationDone(false);
    setManualEstimationSummary(null);
  }
}

      Alert.alert(t.ok, `${t.fileChosen}: ${picked.name}`);
    } catch (error) {
      console.log(error);
      Alert.alert(t.error, t.pickerError);
    }
  };

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t.error, t.requiredFields);
      return;
    }

    setLoadingLogin(true);
    setTimeout(() => {
      setLoadingLogin(false);
      setScreen('dashboard');
    }, 900);
  };

  const handleRegister = () => {
    if (
      !fullName.trim() ||
      !registerEmail.trim() ||
      !registerPassword.trim() ||
      !confirmPassword.trim()
    ) {
      Alert.alert(t.error, t.registerFillAll);
      return;
    }

    if (registerPassword !== confirmPassword) {
      Alert.alert(t.error, t.registerPasswordMismatch);
      return;
    }

    Alert.alert(t.success, t.registerSuccess);
    setScreen('login');
  };

  const runAutoEstimation = () => {
    if (!autoFile) {
      Alert.alert(t.error, t.selectFileFirst);
      return;
    }

    setAutoEstimating(true);
    setTimeout(() => {
      const summary = simulateEstimation('multivariate');
      setAutoEstimationSummary(summary);
      setAutoEstimationDone(true);
      setAutoEstimating(false);
      Alert.alert(t.ok, t.estimationDone);
    }, 1200);
  };

  const runManualEstimation = () => {
  if (!manualFile) {
    Alert.alert(t.error, t.selectFileFirst);
    return;
  }

  setManualEstimating(true);
  setTimeout(() => {
    const summary = simulateEstimation('multivariate');
    setManualEstimationSummary(summary);
    setManualEstimationDone(true);
    setManualEstimating(false);
    Alert.alert(t.ok, t.estimationDone);
  }, 1200);
};

const runManualRecommendation = async () => {
  if (!manualFile) {
    Alert.alert(t.error, t.selectFileFirst);
    return;
  }

  if (!manualTargetColumn.trim()) {
    Alert.alert(t.error, t.enterTargetColumn);
    return;
  }

  setManualRecommendationLoading(true);

  try {
    const fileBase64 = await readFileAsBase64(manualFile);

    const payload = {
      study_type: manualStudyType,
      file_name: manualFile.name,
      file_base64: fileBase64,
      target_column: manualTargetColumn.trim(),
      date_column: manualDateColumn.trim() || null,
    };

    const data = await postToBackend('/recommend/manual', payload);
    setManualRecommendation(data);
    setManualRecommendationLoading(false);
  } catch (error: any) {
    console.log(error);
    setManualRecommendationLoading(false);
    Alert.alert(t.backendError, error?.message || t.manualRecommendationFailed);
  }
};

const applyRecommendedModel = (model: string) => {
  const meta = findModelMeta(model);
  setSelectedModel(model);
  setSelectedCategory(meta.category);
    Alert.alert(t.ok, `${t.selectedModelMessage}: ${model}`);
};

const runAutomaticForecast = async () => {
  console.log('STEP 1: runAutomaticForecast started');

  if (autoStudyType !== 'univariate') {
    console.log('STEP 1A: wrong study type');
    Alert.alert(t.info, t.univariateBackendOnly);
    return;
  }

  if (!autoFile) {
    console.log('STEP 1B: no file selected');
    Alert.alert(t.error, t.selectFileFirst);
    return;
  }

  if (!autoTargetColumn.trim()) {
    console.log('STEP 1C: target column is empty');
    Alert.alert(t.error, t.enterTargetColumn);
    return;
  }

  const horizon = parseHorizon(autoHorizon);
  if (!horizon) {
    console.log('STEP 1D: invalid horizon');
    Alert.alert(t.error, t.selectHorizonFirst);
    return;
  }

  setAutoProcessing(true);

  try {
    console.log('STEP 2: before readFileAsBase64');

    const fileBase64 = await readFileAsBase64(autoFile);

    console.log('STEP 3: after readFileAsBase64', fileBase64?.length);

    const payload = {
      study_type: 'univariate',
      mode: 'automatic',
      language,
      horizon,
      test_size: parseInt(autoTestSize, 10) || 6,
      file_name: autoFile.name,
      file_base64: fileBase64,
      target_column: autoTargetColumn.trim(),
      date_column: autoDateColumn.trim() || null,
    };

    console.log('STEP 4: before backend request', payload);

    const data = await postToBackend('/forecast/automatic', payload);

    console.log('STEP 5: backend response', data);

    const forecast = buildForecastFromBackend({
      data,
      type: 'automatic',
      studyType: autoStudyType,
      horizon,
      fileName: autoFile.name,
    });

    console.log('STEP 6: forecast built successfully');

   setForecasts((prev) => [forecast, ...prev]);
setSelectedForecast(forecast);
setIntegrationPreview('');
setIntegrationTarget(null);
setIntegrationResult(null);

await saveForecastToBackend(forecast);

setAutoProcessing(false);
setScreen('detail');

    console.log('STEP 7: finished successfully');
  } catch (error: any) {
    console.log('AUTO ERROR:', error);
    setAutoProcessing(false);
    Alert.alert(t.backendError, error?.message || t.automaticForecastFailed);
  }
};
const runManualForecast = async () => {
  if (manualStudyType !== 'univariate') {
    Alert.alert(t.info, t.univariateBackendOnly);
    return;
  }

  if (!selectedModel) {
    Alert.alert(t.error, t.selectModelFirst);
    return;
  }

  if (!manualFile) {
    Alert.alert(t.error, t.selectFileFirst);
    return;
  }

  if (!manualTargetColumn.trim()) {
    Alert.alert(t.error, t.enterTargetColumn);
    return;
  }

  const horizon = parseHorizon(manualHorizon);
  if (!horizon) {
    Alert.alert(t.error, t.selectHorizonFirst);
    return;
  }

  setManualProcessing(true);

  try {
    const fileBase64 = await readFileAsBase64(manualFile);

    const payload = {
      study_type: 'univariate',
      mode: 'manual',
      language,
      model: selectedModel,
      horizon,
      test_size: parseInt(manualTestSize, 10) || 6,
      file_name: manualFile.name,
      file_base64: fileBase64,
      target_column: manualTargetColumn.trim(),
      date_column: manualDateColumn.trim() || null,
    };

    const data = await postToBackend('/forecast/manual', payload);

    const forecast = buildForecastFromBackend({
      data,
      type: 'manual',
      studyType: manualStudyType,
      horizon,
      fileName: manualFile.name,
      fallbackModel: selectedModel,
    });

    setForecasts((prev) => [forecast, ...prev]);
setSelectedForecast(forecast);
setIntegrationPreview('');
setIntegrationTarget(null);
setIntegrationResult(null);

await saveForecastToBackend(forecast);

setManualProcessing(false);
setScreen('detail');
  } catch (error: any) {
    console.log(error);
    setManualProcessing(false);
    Alert.alert(t.backendError, error?.message || t.manualForecastFailed);
  }
};
  const deleteForecast = (id: string) => {
    setForecasts((prev) => prev.filter((item) => item.id !== id));
  };

  const updateSelectedForecast = (updated: Forecast) => {
    setSelectedForecast(updated);
    setForecasts((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  const handleSelectSector = (sector: string) => {
    if (!selectedForecast) return;
    updateSelectedForecast({ ...selectedForecast, sector });
  };

  const buildIntegrationPayload = (
    forecast: Forecast,
    target: IntegrationTarget
  ) => ({
    platform:
      target === 'fiddler'
        ? 'Fiddler AI'
        : target === 'datarobot'
        ? 'DataRobot'
        : 'Package',
    sector: getSectorLabel(forecast.sector, t),
    forecast_name: getForecastDisplayName(forecast, t),
    forecast_type: forecast.type,
    selected_model: forecast.model,
    date: forecast.date,
    study_type: forecast.studyType,
    forecast_horizon: forecast.horizon,
    file_name: forecast.fileName,
    variables: getStudyVariables(forecast, t),
    estimation_summary: forecast.estimationSummary,
    metrics: forecast.metrics,
    benchmark_models: forecast.benchmarkSummary.map((entry) => ({
      model: entry.model,
      category: entry.category,
      subgroup: entry.subgroup ?? null,
      mae: entry.mae,
      rmse: entry.rmse,
      mse: entry.mse,
      accuracy: entry.accuracy,
    })),
    actual_values: forecast.actualSeries,
    predicted_values: forecast.predictions,
    note:
      target === 'fiddler'
        ? t.preparedForAnalysis
        : target === 'datarobot'
        ? t.preparedForDecision
        : t.preparedAsPackage,
  });

  const handleIntegration = async (target: IntegrationTarget) => {
  if (!selectedForecast) return;

  if (!selectedForecast.sector) {
    Alert.alert(t.info, t.chooseSector);
    return;
  }

  if (target === 'package') {
    const payload = buildIntegrationPayload(selectedForecast, target);
    setIntegrationTarget(target);
    setIntegrationPreview(JSON.stringify(payload, null, 2));
    setIntegrationResult(null);
    Alert.alert(t.packagePrepared, t.integrationPending);
    return;
  }

  const resultPayload = {
    selected_model:
      selectedForecast.type === 'manual' ? selectedForecast.model : undefined,

    best_model:
      selectedForecast.type === 'automatic' ? selectedForecast.model : undefined,

    metrics: selectedForecast.metrics,

    actual_series: selectedForecast.actualSeries,

    predicted_series: selectedForecast.predictedSeries,

    future_predictions: selectedForecast.predictions,

    ranking: selectedForecast.benchmarkSummary.map((entry) => ({
      model: entry.model,
      mae: entry.mae,
      rmse: entry.rmse,
      mse: entry.mse,
    })),

    message: selectedForecast.message,
  };

  const payload = {
    platform: target,
    result: resultPayload,
    sector: selectedForecast.sector,
    study_type: selectedForecast.studyType,
    mode: selectedForecast.type,
  };

  try {
    console.log('SENDING INTEGRATION PAYLOAD:', payload);

    const data = await postToBackend('/integrations/prepare', payload);

    console.log('INTEGRATION RESPONSE FROM BACKEND:', data);

    setIntegrationTarget(target);
    setIntegrationResult(data);

    // مهم: هذا يعرض JSON الحقيقي كما أرسله backend
    setIntegrationPreview(JSON.stringify(data, null, 2));

    Alert.alert(
      target === 'fiddler' ? t.fiddlerTitle : t.datarobotTitle,
      t.integrationPending
    );
  } catch (error: any) {
    console.log('INTEGRATION PREPARE ERROR:', error);
    Alert.alert(
      t.backendError,
      error?.message || 'Integration payload preparation failed.'
    );
  }
};
const saveForecastToBackend = async (
  forecast: Forecast,
  integration: any | null = null,
  report: any | null = null
) => {
  try {
    const payload = {
      forecast,
      integration,
      report,
    };

    const data = await postToBackend('/forecasts/save', payload);

    console.log('FORECAST SAVED TO BACKEND:', data);

    return data;
  } catch (error) {
    console.log('SAVE FORECAST ERROR:', error);
    return null;
  }
};
const renderIntegrationCards = () => {
  if (!integrationResult) return null;

  const tx = t as any;

  const labels = {
    platform: tx.integrationPlatform ?? 'Platform',
    purpose: tx.integrationPurpose ?? 'Purpose',
    status: tx.integrationStatus ?? 'Status',
    decisionSupport: tx.decisionSupport ?? 'Decision support',
    signal: tx.decisionSignal ?? 'Signal',
    recommendation: tx.decisionRecommendation ?? 'Recommendation',
    confidenceNote: tx.confidenceNote ?? 'Confidence note',
  };

  const platform = integrationResult.platform ?? '--';
  const purpose = integrationResult.purpose ?? '--';
  const status = integrationResult.status ?? '--';

  const modelName =
    integrationResult.forecast_context?.model_name ??
    selectedForecast?.model ??
    '--';

  const studyType =
    integrationResult.forecast_context?.study_type ??
    selectedForecast?.studyType ??
    '--';

  const mode =
    integrationResult.forecast_context?.mode ??
    selectedForecast?.type ??
    '--';

  const metrics = integrationResult.metrics ?? {};
  const decisionSupport = integrationResult.decision_support;

  const formatMetric = (value: any) => {
    if (value === null || value === undefined) return '--';
    if (typeof value === 'number') return value.toFixed(3);
    return String(value);
  };

  const purposeLabel =
    purpose === 'analysis_and_interpretation'
      ? t.fiddlerDesc
      : purpose === 'decision_guidance'
      ? t.datarobotDesc
      : purpose;

  const statusLabel =
    status === 'prepared_only'
      ? t.integrationPending
      : status;

  const getDecisionRecommendation = () => {
    const signal = decisionSupport?.signal;

    if (language === 'ar') {
      if (signal === 'upward_forecast') {
        return 'تشير التوقعات إلى اتجاه تصاعدي، لذلك يُنصح بالاستعداد لقيم أعلى في الفترات القادمة.';
      }

      if (signal === 'downward_forecast') {
        return 'تشير التوقعات إلى اتجاه تنازلي، لذلك يُنصح بمراجعة الطلب أو تقليل المخاطر المحتملة.';
      }

      if (signal === 'stable_forecast') {
        return 'تبدو التوقعات مستقرة نسبيًا، ويمكن الحفاظ على الخطة الحالية مع مراقبة أخطاء النموذج.';
      }

      return decisionSupport?.recommendation ?? '--';
    }

    if (language === 'fr') {
      if (signal === 'upward_forecast') {
        return 'Les prévisions indiquent une tendance haussière. Il est recommandé de se préparer à des valeurs plus élevées.';
      }

      if (signal === 'downward_forecast') {
        return 'Les prévisions indiquent une tendance baissière. Il est recommandé de revoir la demande ou de réduire les risques.';
      }

      if (signal === 'stable_forecast') {
        return 'Les prévisions semblent relativement stables. Maintenez le plan actuel tout en surveillant les erreurs du modèle.';
      }

      return decisionSupport?.recommendation ?? '--';
    }

    return decisionSupport?.recommendation ?? '--';
  };

  const getDecisionSignalLabel = () => {
    const signal = decisionSupport?.signal;

    if (language === 'ar') {
      if (signal === 'upward_forecast') return 'اتجاه تصاعدي';
      if (signal === 'downward_forecast') return 'اتجاه تنازلي';
      if (signal === 'stable_forecast') return 'اتجاه مستقر';
      return signal ?? '--';
    }

    if (language === 'fr') {
      if (signal === 'upward_forecast') return 'Tendance haussière';
      if (signal === 'downward_forecast') return 'Tendance baissière';
      if (signal === 'stable_forecast') return 'Tendance stable';
      return signal ?? '--';
    }

    if (signal === 'upward_forecast') return 'Upward forecast';
    if (signal === 'downward_forecast') return 'Downward forecast';
    if (signal === 'stable_forecast') return 'Stable forecast';

    return signal ?? '--';
  };

  const getConfidenceNote = () => {
    if (language === 'ar') {
      return 'يجب مراجعة مستوى الثقة في القرار مع مقاييس MAE و RMSE و MSE وجودة البيانات وسياق المؤسسة.';
    }

    if (language === 'fr') {
      return 'La confiance dans la décision doit être examinée avec MAE, RMSE, MSE, la qualité des données et le contexte métier.';
    }

    return (
      decisionSupport?.confidence_note ??
      'Decision confidence should be reviewed together with MAE, RMSE, MSE, business context, and data quality.'
    );
  };

  return (
    <View style={styles.whiteCard}>
      <Text style={styles.sectionTitle}>
        {platform === 'Fiddler AI' ? t.fiddlerTitle : t.datarobotTitle}
      </Text>

      <View style={styles.integrationSummaryCard}>
        <Text style={styles.integrationSummaryLabel}>{labels.platform}</Text>
        <Text style={styles.integrationSummaryValue}>{platform}</Text>
      </View>

      <View style={styles.integrationSummaryCard}>
        <Text style={styles.integrationSummaryLabel}>{labels.purpose}</Text>
        <Text style={styles.integrationSummaryValue}>{purposeLabel}</Text>
      </View>

      <View style={styles.integrationSummaryCard}>
        <Text style={styles.integrationSummaryLabel}>{labels.status}</Text>
        <Text style={styles.integrationSummaryValue}>{statusLabel}</Text>
      </View>

      <View style={styles.integrationSummaryCard}>
        <Text style={styles.integrationSummaryLabel}>{t.model}</Text>
        <Text style={styles.integrationSummaryValue}>{modelName}</Text>
      </View>

      <View style={styles.integrationSummaryRow}>
        <View style={styles.integrationMetricBox}>
          <Text style={styles.integrationSummaryLabel}>MAE</Text>
          <Text style={styles.integrationMetricValue}>
            {formatMetric(metrics.mae)}
          </Text>
        </View>

        <View style={styles.integrationMetricBox}>
          <Text style={styles.integrationSummaryLabel}>RMSE</Text>
          <Text style={styles.integrationMetricValue}>
            {formatMetric(metrics.rmse)}
          </Text>
        </View>

        <View style={styles.integrationMetricBox}>
          <Text style={styles.integrationSummaryLabel}>{t.mse}</Text>
          <Text style={styles.integrationMetricValue}>
            {formatMetric(metrics.mse)}
          </Text>
        </View>
      </View>

      <View style={styles.integrationSummaryCard}>
        <Text style={styles.integrationSummaryLabel}>{t.study}</Text>
        <Text style={styles.integrationSummaryValue}>
          {studyType} / {mode}
        </Text>
      </View>

      {decisionSupport ? (
        <View style={styles.decisionCard}>
          <Text style={styles.decisionTitle}>{labels.decisionSupport}</Text>

          <Text style={styles.integrationSummaryLabel}>{labels.signal}</Text>
          <Text style={styles.integrationSummaryValue}>
            {getDecisionSignalLabel()}
          </Text>

          <Text style={[styles.integrationSummaryLabel, { marginTop: 10 }]}>
            {labels.recommendation}
          </Text>
          <Text style={styles.decisionText}>
            {getDecisionRecommendation()}
          </Text>

          <Text style={[styles.integrationSummaryLabel, { marginTop: 10 }]}>
            {labels.confidenceNote}
          </Text>
          <Text style={styles.decisionText}>
            {getConfidenceNote()}
          </Text>
        </View>
      ) : null}

      <Text style={styles.integrationNote}>
  {integrationResult.note ?? t.integrationPending}
</Text>

<TouchableOpacity
  style={[styles.primaryButton, { marginTop: 14, backgroundColor: palette.teal }]}
  onPress={exportTxtReportFile}
>
  <Text style={styles.primaryButtonText}>{t.exportTxtReport}</Text>
</TouchableOpacity>

<TouchableOpacity
  style={[styles.primaryButton, { marginTop: 10, backgroundColor: palette.purple }]}
  onPress={exportJsonReportFile}
>
  <Text style={styles.primaryButtonText}>{t.exportJsonReport}</Text>
</TouchableOpacity>

<TouchableOpacity
  style={[styles.primaryButton, { marginTop: 10, backgroundColor: palette.navy }]}
  onPress={exportPdfReportFile}
>
  <Text style={styles.primaryButtonText}>{t.exportPdfReport}</Text>
</TouchableOpacity>
    </View>
  );
};
const buildReportText = () => {
  if (!selectedForecast) return '';

  const platform = integrationResult?.platform ?? '--';
  const purpose = integrationResult?.purpose ?? '--';
  const status = integrationResult?.status ?? '--';

  const modelName =
    integrationResult?.forecast_context?.model_name ??
    selectedForecast.model ??
    '--';

  const metrics = integrationResult?.metrics ?? selectedForecast.metrics ?? {};

  const decisionSupport = integrationResult?.decision_support;

  const futureValues =
    integrationResult?.future_predictions ??
    selectedForecast.predictions ??
    [];

  const actualValues =
    integrationResult?.series?.actual ??
    selectedForecast.actualSeries ??
    [];

  const predictedValues =
    integrationResult?.series?.predicted ??
    selectedForecast.predictedSeries ??
    [];

  const decisionSignal = decisionSupport?.signal ?? '--';

  const decisionRecommendation =
    decisionSupport?.recommendation ??
    integrationResult?.note ??
    '--';

  const reportLines = [
    '==============================',
    t.reportTitle,
    '==============================',
    '',
    `${t.date}: ${today()}`,
    `${t.file}: ${selectedForecast.fileName}`,
    `${t.sectorTitle}: ${getSectorLabel(selectedForecast.sector, t) || '--'}`,
    `${t.type}: ${
      selectedForecast.type === 'automatic' ? t.typeAutomatic : t.typeManual
    }`,
    `${t.study}: ${
      selectedForecast.studyType === 'univariate'
        ? t.univariate
        : t.multivariate
    }`,
    `${t.forecastHorizon}: ${selectedForecast.horizon} ${t.periods}`,
    '',
    '------------------------------',
    `${t.model}`,
    '------------------------------',
    `${t.model}: ${modelName}`,
    `${t.integrationPlatform ?? 'Platform'}: ${platform}`,
    `${t.integrationPurpose ?? 'Purpose'}: ${purpose}`,
    `${t.integrationStatus ?? 'Status'}: ${status}`,
    '',
    '------------------------------',
    `${t.metrics}`,
    '------------------------------',
    `MAE: ${metrics?.mae ?? '--'}`,
    `RMSE: ${metrics?.rmse ?? '--'}`,
    `${t.mse}: ${metrics?.mse ?? '--'}`,
    '',
    '------------------------------',
    `${t.actualVsPredicted}`,
    '------------------------------',
    `${t.actual}: ${
      actualValues.length ? actualValues.join(' | ') : '--'
    }`,
    `${t.predicted}: ${
      predictedValues.length ? predictedValues.join(' | ') : '--'
    }`,
    '',
    '------------------------------',
    `${t.forecastOutput}`,
    '------------------------------',
    `${futureValues.length ? futureValues.join(' | ') : '--'}`,
    '',
    '------------------------------',
    `${t.decisionSupport ?? 'Decision support'}`,
    '------------------------------',
    `${t.decisionSignal ?? 'Signal'}: ${decisionSignal}`,
    `${t.decisionRecommendation ?? 'Recommendation'}: ${decisionRecommendation}`,
    '',
    '------------------------------',
    'Note',
    '------------------------------',
    integrationResult?.note ?? t.integrationPending,
  ];

  return reportLines.join('\n');
};
const buildReportJson = () => {
  if (!selectedForecast) return null;

  return {
    report_title: t.jsonReportTitle,
    generated_at: new Date().toISOString(),
    language,
    forecast: {
      id: selectedForecast.id,
      name: getForecastDisplayName(selectedForecast, t),
      type: selectedForecast.type,
      study_type: selectedForecast.studyType,
      model: selectedForecast.model,
      file_name: selectedForecast.fileName,
      date: selectedForecast.date,
      horizon: selectedForecast.horizon,
      sector: selectedForecast.sector,
      sector_label: getSectorLabel(selectedForecast.sector, t),
    },
    metrics: selectedForecast.metrics,
    actual_series: selectedForecast.actualSeries,
    predicted_series: selectedForecast.predictedSeries,
    future_predictions: selectedForecast.predictions,
    benchmark_summary: selectedForecast.benchmarkSummary,
    integration: integrationResult
      ? {
          platform: integrationResult.platform,
          purpose: integrationResult.purpose,
          status: integrationResult.status,
          forecast_context: integrationResult.forecast_context,
          metrics: integrationResult.metrics,
          ranking: integrationResult.ranking,
          future_predictions: integrationResult.future_predictions,
          decision_support: integrationResult.decision_support,
          note: integrationResult.note,
        }
      : null,
  };
};
const buildPdfHtml = () => {
  if (!selectedForecast) return '';

  const platform = integrationResult?.platform ?? '--';
  const purpose = integrationResult?.purpose ?? '--';
  const status = integrationResult?.status ?? '--';

  const modelName =
    integrationResult?.forecast_context?.model_name ??
    selectedForecast.model ??
    '--';

  const metrics = integrationResult?.metrics ?? selectedForecast.metrics ?? {};
  const decisionSupport = integrationResult?.decision_support;

  const futureValues =
    integrationResult?.future_predictions ??
    selectedForecast.predictions ??
    [];

  const actualValues =
    integrationResult?.series?.actual ??
    selectedForecast.actualSeries ??
    [];

  const predictedValues =
    integrationResult?.series?.predicted ??
    selectedForecast.predictedSeries ??
    [];

  const decisionSignal = decisionSupport?.signal ?? '--';

  const getDecisionRecommendationForPdf = () => {
    const signal = decisionSupport?.signal;

    if (language === 'ar') {
      if (signal === 'upward_forecast') {
        return 'تشير التوقعات إلى اتجاه تصاعدي، لذلك يُنصح بالاستعداد لقيم أعلى في الفترات القادمة.';
      }

      if (signal === 'downward_forecast') {
        return 'تشير التوقعات إلى اتجاه تنازلي، لذلك يُنصح بمراجعة الطلب أو تقليل المخاطر المحتملة.';
      }

      if (signal === 'stable_forecast') {
        return 'تبدو التوقعات مستقرة نسبيًا، ويمكن الحفاظ على الخطة الحالية مع مراقبة أخطاء النموذج.';
      }
    }

    if (language === 'fr') {
      if (signal === 'upward_forecast') {
        return 'Les prévisions indiquent une tendance haussière. Il est recommandé de se préparer à des valeurs plus élevées.';
      }

      if (signal === 'downward_forecast') {
        return 'Les prévisions indiquent une tendance baissière. Il est recommandé de revoir la demande ou de réduire les risques.';
      }

      if (signal === 'stable_forecast') {
        return 'Les prévisions semblent relativement stables. Maintenez le plan actuel tout en surveillant les erreurs du modèle.';
      }
    }

    return decisionSupport?.recommendation ?? '--';
  };

  const escapeHtml = (value: any) =>
    String(value ?? '--')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const formatNumber = (value: any) => {
    if (value === null || value === undefined) return '--';
    if (typeof value === 'number') return value.toFixed(3);
    return String(value);
  };

  const listToText = (values: any[]) =>
    Array.isArray(values) && values.length
      ? values.map((item) => formatNumber(item)).join(' | ')
      : '--';

  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const textAlign = language === 'ar' ? 'right' : 'left';

  return `
<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <style>
    @page {
      margin: 24px;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      background: #F4F8FC;
      color: #11263A;
      direction: ${dir};
      text-align: ${textAlign};
      padding: 0;
      margin: 0;
    }

    .page {
      background: #FFFFFF;
      border-radius: 18px;
      padding: 28px;
      border: 1px solid #DCE6F0;
    }

    .header {
      background: linear-gradient(135deg, #08243D, #0B63E5);
      color: #FFFFFF;
      border-radius: 18px;
      padding: 24px;
      margin-bottom: 20px;
    }

    .title {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 8px;
    }

    .subtitle {
      font-size: 14px;
      opacity: 0.9;
    }

    .section {
      margin-top: 18px;
      padding: 16px;
      border: 1px solid #E7EEF7;
      border-radius: 14px;
      background: #F8FBFE;
    }

    .section-title {
      font-size: 18px;
      font-weight: 800;
      color: #0B63E5;
      margin-bottom: 12px;
    }

    .row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
      border-bottom: 1px solid #E7EEF7;
      padding-bottom: 8px;
    }

    .label {
      color: #7B8A9A;
      font-weight: 700;
      width: 42%;
    }

    .value {
      color: #11263A;
      font-weight: 700;
      width: 58%;
      word-break: break-word;
    }

    .metrics {
      display: flex;
      gap: 12px;
      margin-top: 10px;
    }

    .metric {
      flex: 1;
      background: #FFFFFF;
      border: 1px solid #DCE6F0;
      border-radius: 14px;
      padding: 14px;
      text-align: center;
    }

    .metric-label {
      color: #7B8A9A;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .metric-value {
      color: #0B63E5;
      font-size: 18px;
      font-weight: 800;
    }

    .decision {
      background: #ECFDF3;
      border-color: #B7E4C7;
    }

    .decision .section-title {
      color: #18B368;
    }

    .long-text {
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .footer {
      margin-top: 24px;
      color: #7B8A9A;
      font-size: 12px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="title">${escapeHtml(t.reportTitle)}</div>
      <div class="subtitle">Forecast DZ - ${escapeHtml(today())}</div>
    </div>

    <div class="section">
      <div class="section-title">${escapeHtml(t.forecastDetails)}</div>
      <div class="row">
        <div class="label">${escapeHtml(t.date)}</div>
        <div class="value">${escapeHtml(today())}</div>
      </div>
      <div class="row">
        <div class="label">${escapeHtml(t.file)}</div>
        <div class="value">${escapeHtml(selectedForecast.fileName)}</div>
      </div>
      <div class="row">
        <div class="label">${escapeHtml(t.sectorTitle)}</div>
        <div class="value">${escapeHtml(getSectorLabel(selectedForecast.sector, t) || '--')}</div>
      </div>
      <div class="row">
        <div class="label">${escapeHtml(t.type)}</div>
        <div class="value">${escapeHtml(selectedForecast.type === 'automatic' ? t.typeAutomatic : t.typeManual)}</div>
      </div>
      <div class="row">
        <div class="label">${escapeHtml(t.study)}</div>
        <div class="value">${escapeHtml(selectedForecast.studyType === 'univariate' ? t.univariate : t.multivariate)}</div>
      </div>
      <div class="row">
        <div class="label">${escapeHtml(t.forecastHorizon)}</div>
        <div class="value">${escapeHtml(`${selectedForecast.horizon} ${t.periods}`)}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">${escapeHtml(t.model)}</div>
      <div class="row">
        <div class="label">${escapeHtml(t.model)}</div>
        <div class="value">${escapeHtml(modelName)}</div>
      </div>
      <div class="row">
        <div class="label">${escapeHtml((t as any).integrationPlatform ?? 'Platform')}</div>
        <div class="value">${escapeHtml(platform)}</div>
      </div>
      <div class="row">
        <div class="label">${escapeHtml((t as any).integrationPurpose ?? 'Purpose')}</div>
        <div class="value">${escapeHtml(purpose)}</div>
      </div>
      <div class="row">
        <div class="label">${escapeHtml((t as any).integrationStatus ?? 'Status')}</div>
        <div class="value">${escapeHtml(status)}</div>
      </div>

      <div class="metrics">
        <div class="metric">
          <div class="metric-label">MAE</div>
          <div class="metric-value">${escapeHtml(formatNumber(metrics?.mae))}</div>
        </div>
        <div class="metric">
          <div class="metric-label">RMSE</div>
          <div class="metric-value">${escapeHtml(formatNumber(metrics?.rmse))}</div>
        </div>
        <div class="metric">
          <div class="metric-label">${escapeHtml(t.mse)}</div>
          <div class="metric-value">${escapeHtml(formatNumber(metrics?.mse))}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">${escapeHtml(t.actualVsPredicted)}</div>
      <div class="row">
        <div class="label">${escapeHtml(t.actual)}</div>
        <div class="value long-text">${escapeHtml(listToText(actualValues))}</div>
      </div>
      <div class="row">
        <div class="label">${escapeHtml(t.predicted)}</div>
        <div class="value long-text">${escapeHtml(listToText(predictedValues))}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">${escapeHtml(t.forecastOutput)}</div>
      <div class="long-text">${escapeHtml(listToText(futureValues))}</div>
    </div>

    <div class="section decision">
      <div class="section-title">${escapeHtml((t as any).decisionSupport ?? 'Decision support')}</div>
      <div class="row">
        <div class="label">${escapeHtml((t as any).decisionSignal ?? 'Signal')}</div>
        <div class="value">${escapeHtml(decisionSignal)}</div>
      </div>
      <div class="row">
        <div class="label">${escapeHtml((t as any).decisionRecommendation ?? 'Recommendation')}</div>
        <div class="value long-text">${escapeHtml(getDecisionRecommendationForPdf())}</div>
      </div>
      <div class="row">
        <div class="label">${escapeHtml((t as any).confidenceNote ?? 'Confidence note')}</div>
        <div class="value long-text">${escapeHtml(
          language === 'ar'
            ? 'يجب مراجعة مستوى الثقة في القرار مع مقاييس MAE و RMSE و MSE وجودة البيانات وسياق المؤسسة.'
            : language === 'fr'
            ? 'La confiance dans la décision doit être examinée avec MAE, RMSE, MSE, la qualité des données et le contexte métier.'
            : decisionSupport?.confidence_note ?? 'Decision confidence should be reviewed together with MAE, RMSE, MSE, business context, and data quality.'
        )}</div>
      </div>
    </div>

    <div class="footer">
      ${escapeHtml(integrationResult?.note ?? t.integrationPending)}
    </div>
  </div>
</body>
</html>
`;
};
const exportForecastReport = async () => {
  try {
    const reportText = buildReportText();

    if (!reportText) {
      Alert.alert(t.error, t.noData);
      return;
    }

    await Share.share({
      title: t.reportTitle,
      message: reportText,
    });
  } catch (error) {
    console.log('REPORT EXPORT ERROR:', error);
    Alert.alert(t.error, t.reportExportFailed);
  }
};
const shareFile = async (
  fileName: string,
  content: string,
  mimeType: string
) => {
  try {
    if (Platform.OS === 'web') {
      await Share.share({
        title: fileName,
        message: content,
      });
      return;
    }

    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();

    if (!isAvailable) {
      await Share.share({
        title: fileName,
        message: content,
      });
      return;
    }

    await Sharing.shareAsync(fileUri, {
      mimeType,
      dialogTitle: fileName,
      UTI: mimeType,
    });
  } catch (error) {
    console.log('FILE SHARE ERROR:', error);
    Alert.alert(t.error, t.reportExportFailed);
  }
};

const exportTxtReportFile = async () => {
  const reportText = buildReportText();

  if (!reportText) {
    Alert.alert(t.error, t.noData);
    return;
  }

  const fileName = `ForecastDZ_Report_${today()}.txt`;

  await shareFile(fileName, reportText, 'text/plain');
};

const exportJsonReportFile = async () => {
  const reportJson = buildReportJson();

  if (!reportJson) {
    Alert.alert(t.error, t.noData);
    return;
  }

  const fileName = `ForecastDZ_Report_${today()}.json`;
  const content = JSON.stringify(reportJson, null, 2);

  await shareFile(fileName, content, 'application/json');
};
const exportPdfReportFile = async () => {
  try {
    if (!selectedForecast) {
      Alert.alert(t.error, t.noData);
      return;
    }

    const html = buildPdfHtml();

    if (!html) {
      Alert.alert(t.error, t.noData);
      return;
    }

    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
      return;
    }

    const result = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const isAvailable = await Sharing.isAvailableAsync();

    if (!isAvailable) {
      Alert.alert(t.ok, t.pdfReportPrepared);
      return;
    }

    await Sharing.shareAsync(result.uri, {
      mimeType: 'application/pdf',
      dialogTitle: `ForecastDZ_Report_${today()}.pdf`,
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    console.log('PDF EXPORT ERROR:', error);
    Alert.alert(t.error, t.reportExportFailed);
  }
};
const renderLanguageBar = () => (
    <View style={styles.languageBar}>
      {(['en', 'fr', 'ar'] as Lang[]).map((lang) => (
        <TouchableOpacity
          key={lang}
          style={[
            styles.languageChip,
            language === lang && styles.languageChipActive,
          ]}
          onPress={() => setLanguage(lang)}
        >
          <Text
            style={[
              styles.languageChipText,
              language === lang && styles.languageChipTextActive,
            ]}
          >
            {lang.toUpperCase()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderHeader = (title: string, onBack?: () => void) => (
    <View style={styles.pageHeader}>
      <TouchableOpacity
        style={styles.headerSideButton}
        onPress={() => setShowSettings(true)}
      >
        <MaterialIcons name="settings" size={22} color={palette.textDark} />
      </TouchableOpacity>

      <Text style={styles.pageHeaderTitle}>{title}</Text>

      <TouchableOpacity
        style={[
          styles.headerSideButton,
          !onBack && styles.headerSideButtonHidden,
        ]}
        onPress={onBack}
        disabled={!onBack}
      >
        <MaterialIcons name={(isRTL ? 'arrow-forward' : 'arrow-back') as never} size={24} color={palette.textDark} />
      </TouchableOpacity>
    </View>
  );

  const renderStudyTypeSelector = (
    value: StudyType,
    onChange: (value: StudyType) => void
  ) => (
    <View style={styles.whiteCard}>
      <Text style={styles.cardTitle}>{t.studyType}</Text>

      <View style={styles.studyTypeRow}>
        <TouchableOpacity
          style={[
            styles.studyTypeButton,
            value === 'univariate' && styles.studyTypeButtonActive,
          ]}
          onPress={() => onChange('univariate')}
        >
          <Text
            style={[
              styles.studyTypeButtonText,
              value === 'univariate' && styles.studyTypeButtonTextActive,
            ]}
          >
            {t.univariate}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.studyTypeButton,
            value === 'multivariate' && styles.studyTypeButtonActive,
          ]}
          onPress={() => onChange('multivariate')}
        >
          <Text
            style={[
              styles.studyTypeButtonText,
              value === 'multivariate' && styles.studyTypeButtonTextActive,
            ]}
          >
            {t.multivariate}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.studyInfoText}>
        {value === 'univariate' ? t.univariateInfo : t.multivariateInfo}
      </Text>
    </View>
  );

  let content: React.ReactNode = null;
    if (screen === 'login') {
    content = (
      <View style={styles.loginContainer}>
        <View style={styles.decorCircleOne} />
        <View style={styles.decorCircleTwo} />
        <View style={styles.decorCircleThree} />

        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.loginScroll}>
          <View style={styles.topLeftBar}>
            <TouchableOpacity
              style={styles.topButton}
              onPress={() => setShowSettings(true)}
            >
              <MaterialIcons name="settings" size={24} color={palette.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.brandArea}>
            <Image
              source={require('../../assets/forecast-dz-logo.png')}
              style={styles.appLogo}
              resizeMode="contain"
            />
            <Text style={styles.brandTitle}>Forecast DZ</Text>
            <Text style={styles.brandSubTitle}>{t.brandSubtitle}</Text>
          </View>

          <View style={styles.loginCard}>
            <Text style={styles.inputLabel}>{t.email}</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="email" size={20} color={palette.royal} />
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput]}
                value={email}
                onChangeText={setEmail}
                placeholder={t.email}
                placeholderTextColor={palette.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.inputLabel}>{t.password}</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="lock" size={20} color={palette.royal} />
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput]}
                value={password}
                onChangeText={setPassword}
                placeholder={t.password}
                placeholderTextColor={palette.textMuted}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleLogin}
              disabled={loadingLogin}
            >
              {loadingLogin ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>{t.login}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.registerRow}>
              <Text style={styles.registerText}>{t.noAccount}</Text>
              <TouchableOpacity onPress={() => setScreen('register')}>
                <Text style={styles.registerLink}>{t.createAccount}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomLanguageWrap}>
            <Text style={styles.languageTitle}>{t.chooseLanguage}</Text>
            {renderLanguageBar()}
          </View>
        </ScrollView>
              </View>
    );
  }

  if (screen === 'register') {
    content = (
      <View style={styles.loginContainer}>
        <View style={styles.decorCircleOne} />
        <View style={styles.decorCircleTwo} />
        <View style={styles.decorCircleThree} />

        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.loginScroll}>
          <View style={styles.topBarRow}>
            <TouchableOpacity
              style={styles.topButton}
              onPress={() => setShowSettings(true)}
            >
              <MaterialIcons name="settings" size={24} color={palette.white} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.topButton}
              onPress={() => setScreen('login')}
            >
              <MaterialIcons
                name="arrow-forward"
                size={24}
                color={palette.white}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.brandAreaSmall}>
            <View style={styles.logoCircleSmall}>
              <MaterialIcons
                name="person-add-alt-1"
                size={38}
                color={palette.white}
              />
            </View>
          </View>

          <View style={styles.loginCard}>
            <Text style={styles.inputLabel}>{t.fullName}</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="person" size={20} color={palette.royal} />
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput]}
                value={fullName}
                onChangeText={setFullName}
                placeholder={t.fullName}
                placeholderTextColor={palette.textMuted}
              />
            </View>

            <Text style={styles.inputLabel}>{t.email}</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="email" size={20} color={palette.royal} />
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput]}
                value={registerEmail}
                onChangeText={setRegisterEmail}
                placeholder={t.email}
                placeholderTextColor={palette.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.inputLabel}>{t.password}</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="lock" size={20} color={palette.royal} />
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput]}
                value={registerPassword}
                onChangeText={setRegisterPassword}
                placeholder={t.password}
                placeholderTextColor={palette.textMuted}
                secureTextEntry
              />
            </View>

            <Text style={styles.inputLabel}>{t.confirmPassword}</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons
                name="verified-user"
                size={20}
                color={palette.royal}
              />
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t.confirmPassword}
                placeholderTextColor={palette.textMuted}
                secureTextEntry
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleRegister}>
              <Text style={styles.primaryButtonText}>{t.register}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (screen === 'dashboard') {
    content = (
      <View style={styles.pageContainer}>
        <ScrollView contentContainerStyle={styles.pageContent}>
          {renderHeader(t.home)}
          <Text style={styles.dashboardTitle}>{t.welcome}</Text>
          <Text style={styles.dashboardSubtitle}>{t.chooseMode}</Text>

          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => setScreen('automatic')}
          >
            <View style={styles.modeIconBox}>
              <MaterialIcons
                name="auto-awesome"
                size={28}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.modeTextWrap}>
              <Text style={styles.modeTitle}>{t.automaticForecast}</Text>
              <Text style={styles.modeDescription}>{t.automaticDesc}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeCard}
            onPress={() => setScreen('manual')}
          >
            <View
              style={[styles.modeIconBox, { backgroundColor: palette.gold }]}
            >
              <MaterialIcons name="tune" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.modeTextWrap}>
              <Text style={styles.modeTitle}>{t.manualForecast}</Text>
              <Text style={styles.modeDescription}>{t.manualDesc}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t.recentForecasts}</Text>
            <TouchableOpacity onPress={() => setScreen('history')}>
              <Text style={styles.viewAllText}>{t.viewAll}</Text>
            </TouchableOpacity>
          </View>

          {latestForecasts.length === 0 ? (
            <View style={styles.whiteCard}>
              <Text style={styles.emptyText}>{t.noForecasts}</Text>
            </View>
          ) : (
            latestForecasts.map((forecast) => (
              <TouchableOpacity
                key={forecast.id}
                style={styles.forecastCard}
                onPress={() => {
                  setSelectedForecast(forecast);
                  setIntegrationPreview('');
                  setIntegrationTarget(null);
                  setScreen('detail');
                }}
              >
                <View style={styles.forecastRow}>
                  <Text style={styles.forecastName}>{getForecastDisplayName(forecast, t)}</Text>
                  <Text style={styles.forecastDate}>{forecast.date}</Text>
                </View>
                <View style={styles.forecastRow}>
                  <Text style={styles.forecastModel}>
                    {forecast.model === '—'
                      ? t.bestModelPending
                      : forecast.model}
                  </Text>
                  <Text style={styles.forecastAccuracy}>
                    {forecast.accuracy !== null
                      ? `${t.accuracy}: ${forecast.accuracy}%`
                      : t.pendingResults}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          <View style={styles.bottomMenu}>
            <TouchableOpacity onPress={() => setScreen('dashboard')}>
              <Text style={styles.bottomMenuActive}>{t.home}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setScreen('history')}>
              <Text style={styles.bottomMenuText}>{t.history}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (screen === 'automatic') {
    content = (
      <View style={styles.pageContainer}>
        <ScrollView contentContainerStyle={styles.pageContent}>
          {renderHeader(t.automaticForecast, () => setScreen('dashboard'))}

          {renderStudyTypeSelector(autoStudyType, (value) => {
            setAutoStudyType(value);
            if (value === 'univariate') {
              setAutoEstimationDone(false);
              setAutoEstimationSummary(null);
            }
          })}

          <View style={styles.whiteCard}>
            <Text style={styles.cardTitle}>1. {t.uploadDataFile}</Text>
            <Text style={styles.cardText}>{t.chooseExcel}</Text>

            <TouchableOpacity
              style={styles.fileBox}
              onPress={() => pickDocument('auto')}
            >
              <MaterialIcons name="cloud-upload" size={34} color={palette.royal} />
              <Text style={styles.fileText}>
                {autoFile ? `${t.file}: ${autoFile.name}` : t.chooseFile}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.whiteCard}>
            <Text style={styles.cardTitle}>2. {t.datasetColumns}</Text>

            <Text style={styles.inputLabel}>{t.targetColumn}</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="table-chart" size={20} color={palette.royal} />
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput]}
                value={autoTargetColumn}
                onChangeText={setAutoTargetColumn}
                placeholder={t.exampleSales}
                placeholderTextColor={palette.textMuted}
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.inputLabel}>{t.dateColumnOptional}</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="event" size={20} color={palette.royal} />
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput]}
                value={autoDateColumn}
                onChangeText={setAutoDateColumn}
                placeholder={t.exampleDate}
                placeholderTextColor={palette.textMuted}
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.inputLabel}>{t.testSize}</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="analytics" size={20} color={palette.royal} />
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput]}
                value={autoTestSize}
                onChangeText={setAutoTestSize}
                placeholder="6"
                placeholderTextColor={palette.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>

          {autoStudyType === 'multivariate' ? (
            <View style={styles.whiteCard}>
              <Text style={styles.cardTitle}>3. {t.estimationStage}</Text>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!autoFile || autoEstimating) && styles.disabledButton,
                ]}
                onPress={runAutoEstimation}
                disabled={!autoFile || autoEstimating}
              >
                {autoEstimating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>{t.runEstimation}</Text>
                )}
              </TouchableOpacity>

              {autoEstimationDone && autoEstimationSummary ? (
                <View style={styles.estimationBox}>
                  <Text style={styles.estimationDoneText}>{t.estimationDone}</Text>
                  <Text style={styles.estimationText}>R²: --</Text>
                  <Text style={styles.estimationText}>AIC: --</Text>
                  <Text style={styles.estimationText}>BIC: --</Text>
                  <Text style={styles.estimationText}>
                    {autoEstimationSummary.equation}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.whiteCard}>
            <Text style={styles.cardTitle}>
              {autoStudyType === 'multivariate' ? '4. ' : '3. '}
              {t.forecastHorizon}
            </Text>

            <View style={styles.inputWrap}>
              <MaterialIcons name="timeline" size={20} color={palette.royal} />
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput]}
                value={autoHorizon}
                onChangeText={setAutoHorizon}
                placeholder={t.periods}
                placeholderTextColor={palette.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.whiteCard}>
            <Text style={styles.cardTitle}>
              {autoStudyType === 'multivariate' ? '5. ' : '4. '}
              {t.benchmarkAllModels}
            </Text>
            <Text style={styles.cardText}>{t.benchmarkNote}</Text>

            <TouchableOpacity
  style={[
    styles.primaryButton,
    (!autoFile || autoProcessing) && styles.disabledButton,
  ]}
  onPress={runAutomaticForecast}
  disabled={!autoFile || autoProcessing}
>
  <Text style={styles.primaryButtonText}>{t.runAuto}</Text>
</TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (screen === 'manual') {
    content = (
      <View style={styles.pageContainer}>
        <ScrollView contentContainerStyle={styles.pageContent}>
          {renderHeader(t.manualForecast, () => setScreen('dashboard'))}

          {renderStudyTypeSelector(manualStudyType, (value) => {
            setManualStudyType(value);
            if (value === 'univariate') {
              setManualEstimationDone(false);
              setManualEstimationSummary(null);
            }
          })}

          <View style={styles.whiteCard}>
            <Text style={styles.cardTitle}>1. {t.selectModel}</Text>
            <Text style={styles.cardText}>{t.manualCompareNote}</Text>

            <TouchableOpacity
              style={styles.selectModelButton}
              onPress={() => setScreen('manualCategories')}
            >
              <View style={styles.selectModelButtonLeft}>
                <MaterialIcons name="category" size={22} color={palette.royal} />
                <Text style={styles.selectModelButtonText}>
                  {selectedModel ? selectedModel : t.chooseCategory}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={palette.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.whiteCard}>
            <Text style={styles.cardTitle}>2. {t.uploadDataFile}</Text>
            <TouchableOpacity
              style={styles.fileBox}
              onPress={() => pickDocument('manual')}
            >
              <MaterialIcons name="upload-file" size={34} color={palette.royal} />
              <Text style={styles.fileText}>
                {manualFile ? `${t.file}: ${manualFile.name}` : t.chooseFile}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.whiteCard}>
  <Text style={styles.cardTitle}>3. {t.datasetColumns}</Text>

  <Text style={styles.inputLabel}>{t.targetColumn}</Text>
  <View style={styles.inputWrap}>
    <MaterialIcons name="table-chart" size={20} color={palette.royal} />
    <TextInput
      style={[styles.input, isRTL && styles.rtlInput]}
      value={manualTargetColumn}
            onChangeText={setManualTargetColumn}
      placeholder={t.exampleSales}
      placeholderTextColor={palette.textMuted}
      autoCapitalize="none"
    />
  </View>

  <Text style={styles.inputLabel}>{t.dateColumnOptional}</Text>
  <View style={styles.inputWrap}>
    <MaterialIcons name="event" size={20} color={palette.royal} />
    <TextInput
      style={[styles.input, isRTL && styles.rtlInput]}
      value={manualDateColumn}
      onChangeText={setManualDateColumn}
      placeholder={t.exampleDate}
      placeholderTextColor={palette.textMuted}
      autoCapitalize="none"
    />
  </View>

  <Text style={styles.inputLabel}>{t.testSize}</Text>
  <View style={styles.inputWrap}>
    <MaterialIcons name="analytics" size={20} color={palette.royal} />
    <TextInput
      style={[styles.input, isRTL && styles.rtlInput]}
      value={manualTestSize}
      onChangeText={setManualTestSize}
      placeholder="6"
      placeholderTextColor={palette.textMuted}
      keyboardType="numeric"
    />
  </View>
</View>

<View style={styles.whiteCard}>
  <Text style={styles.cardTitle}>{t.manualRecommendationTitle}</Text>
  <Text style={styles.cardText}>{t.manualRecommendationDesc}</Text>

  <TouchableOpacity
    style={[
      styles.primaryButton,
      (!manualFile || manualRecommendationLoading) && styles.disabledButton,
    ]}
    onPress={runManualRecommendation}
    disabled={!manualFile || manualRecommendationLoading}
  >
    {manualRecommendationLoading ? (
      <ActivityIndicator color="#FFFFFF" />
    ) : (
      <Text style={styles.primaryButtonText}>{t.analyzeRecommend}</Text>
    )}
  </TouchableOpacity>

  {manualRecommendation ? (
    <View style={{ marginTop: 16 }}>
      <Text style={styles.sectionTitle}>{t.patternsDetected}</Text>
      {manualRecommendation.detected_patterns.map((item, index) => (
        <View key={`${item.name}-${index}`} style={styles.integrationCard}>
          <Text style={styles.integrationTitle}>
            {item.name}: {item.detected ? t.yes : t.no}
          </Text>
          <Text style={styles.integrationDesc}>{item.details}</Text>
        </View>
      ))}

      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
        {t.recommendedModels}
      </Text>
      {manualRecommendation.recommended_models.map((item, index) => (
        <View key={`${item.model}-${index}`} style={styles.integrationCard}>
          <Text style={styles.integrationTitle}>{item.model}</Text>
          <Text style={styles.integrationDesc}>{item.reason}</Text>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => applyRecommendedModel(item.model)}
          >
            <Text style={styles.secondaryButtonText}>{t.chooseThisModel}</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
        {t.whyTheseModels}
      </Text>
      <Text style={styles.detailItem}>{manualRecommendation.summary}</Text>
    </View>
  ) : null}
</View>

{manualStudyType === 'multivariate' ? (
            <View style={styles.whiteCard}>
              <Text style={styles.cardTitle}>4. {t.estimationStage}</Text>

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  (!manualFile || manualEstimating) && styles.disabledButton,
                ]}
                onPress={runManualEstimation}
                disabled={!manualFile || manualEstimating}
              >
                {manualEstimating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>{t.runEstimation}</Text>
                )}
              </TouchableOpacity>

              {manualEstimationDone && manualEstimationSummary ? (
                <View style={styles.estimationBox}>
                  <Text style={styles.estimationDoneText}>{t.estimationDone}</Text>
                  <Text style={styles.estimationText}>R²: --</Text>
                  <Text style={styles.estimationText}>AIC: --</Text>
                  <Text style={styles.estimationText}>BIC: --</Text>
                  <Text style={styles.estimationText}>
                    {manualEstimationSummary.equation}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.whiteCard}>
            <Text style={styles.cardTitle}>
              {manualStudyType === 'multivariate' ? '5. ' : '4. '}
              {t.forecastHorizon}
            </Text>

            <View style={styles.inputWrap}>
              <MaterialIcons name="timeline" size={20} color={palette.royal} />
              <TextInput
                style={[styles.input, isRTL && styles.rtlInput]}
                value={manualHorizon}
                onChangeText={setManualHorizon}
                placeholder={t.periods}
                placeholderTextColor={palette.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.whiteCard}>
            <Text style={styles.cardTitle}>
              {manualStudyType === 'multivariate' ? '6. ' : '5. '}
              {t.applyModel}
            </Text>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!selectedModel || !manualFile || manualProcessing) &&
                  styles.disabledButton,
              ]}
              onPress={runManualForecast}
              disabled={!selectedModel || !manualFile || manualProcessing}
            >
              {manualProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>{t.runManual}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (screen === 'manualCategories') {
    content = (
      <View style={styles.pageContainer}>
        <ScrollView contentContainerStyle={styles.pageContent}>
          {renderHeader(t.modelCategories, () => setScreen('manual'))}

          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => {
              setSelectedCategory('classical');
              setModelSearch('');
              setScreen('manualModels');
            }}
          >
            <View style={styles.categoryIconBox}>
              <MaterialIcons name="analytics" size={26} color="#FFFFFF" />
            </View>
            <View style={styles.categoryTextWrap}>
              <Text style={styles.categoryTitle}>{t.traditionalModels}</Text>
              <Text style={styles.categorySubtitle}>{t.traditionalSubtitle}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => {
              setSelectedCategory('modern');
              setModelSearch('');
              setScreen('manualModels');
            }}
          >
            <View
              style={[styles.categoryIconBox, { backgroundColor: palette.green }]}
            >
              <MaterialIcons name="memory" size={26} color="#FFFFFF" />
            </View>
            <View style={styles.categoryTextWrap}>
              <Text style={styles.categoryTitle}>{t.modernModels}</Text>
              <Text style={styles.categorySubtitle}>{t.modernSubtitle}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.categoryCard}
            onPress={() => {
              setSelectedCategory('hybrid');
              setModelSearch('');
              setScreen('manualModels');
            }}
          >
            <View
              style={[styles.categoryIconBox, { backgroundColor: palette.gold }]}
            >
              <MaterialIcons name="merge-type" size={26} color="#FFFFFF" />
            </View>
            <View style={styles.categoryTextWrap}>
              <Text style={styles.categoryTitle}>{t.hybridModels}</Text>
              <Text style={styles.categorySubtitle}>{t.hybridSubtitle}</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (screen === 'manualModels') {
    const renderModelItem = (model: string, subgroup?: HybridGroupKey) => (
      <TouchableOpacity
        key={model}
        style={styles.modelFancyCard}
        onPress={() => {
          setSelectedModel(model);
          setScreen('manual');
        }}
      >
        <View style={styles.modelFancyLeft}>
          <View style={[styles.modelFancyIconBox, { backgroundColor: '#EAF2FF' }]}>
            <MaterialIcons
              name={
                selectedCategory === 'classical'
                  ? 'functions'
                  : selectedCategory === 'modern'
                  ? 'memory'
                  : 'merge-type'
              }
              size={22}
              color={
                selectedCategory === 'classical'
                  ? palette.royal
                  : selectedCategory === 'modern'
                  ? palette.green
                  : palette.gold
              }
            />
          </View>

          <View style={styles.modelFancyTextWrap}>
            <Text style={styles.modelFancyTitle}>{model}</Text>
            <Text style={styles.modelFancySubtitle}>
              {selectedCategory === 'hybrid' && subgroup
                ? getHybridGroupLabel(subgroup, t)
                : selectedCategory === 'classical'
                ? t.traditionalModels
                : t.modernModels}
            </Text>
          </View>
        </View>

        <MaterialIcons name="chevron-right" size={22} color={palette.textMuted} />
      </TouchableOpacity>
    );

    let modelsContent: React.ReactNode = null;

    if (selectedCategory === 'hybrid') {
      const grouped = HYBRID_GROUPS.map((group) => ({
        ...group,
        filteredModels: group.models.filter((model) =>
          model.toLowerCase().includes(modelSearch.toLowerCase())
        ),
      })).filter((group) => group.filteredModels.length > 0);

      modelsContent =
        grouped.length === 0 ? (
          <View style={styles.whiteCard}>
            <Text style={styles.emptyText}>{t.noMatchingModels}</Text>
          </View>
        ) : (
          grouped.map((group) => (
            <View key={group.key} style={styles.groupBlock}>
              <Text style={styles.groupTitle}>
                {getHybridGroupLabel(group.key, t)}
              </Text>
              {group.filteredModels.map((model) =>
                renderModelItem(model, group.key)
              )}
            </View>
          ))
        );
    } else {
      const models =
        selectedCategory === 'classical' ? CLASSICAL_MODELS : MODERN_MODELS;

      const filtered = models.filter((model) =>
        model.toLowerCase().includes(modelSearch.toLowerCase())
      );

      modelsContent =
        filtered.length === 0 ? (
          <View style={styles.whiteCard}>
            <Text style={styles.emptyText}>{t.noMatchingModels}</Text>
          </View>
        ) : (
          filtered.map((model) => renderModelItem(model))
        );
    }

    content = (
      <View style={styles.pageContainer}>
        <ScrollView contentContainerStyle={styles.pageContent}>
          {renderHeader(t.chooseModel, () => setScreen('manualCategories'))}

          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={22} color={palette.textMuted} />
            <TextInput
              style={[styles.searchInput, isRTL && styles.rtlInput]}
              value={modelSearch}
              onChangeText={setModelSearch}
              placeholder={t.chooseModel}
              placeholderTextColor={palette.textMuted}
            />
          </View>

          {modelsContent}
        </ScrollView>
      </View>
    );
  }

  if (screen === 'history') {
    content = (
      <View style={styles.pageContainer}>
        <ScrollView contentContainerStyle={styles.pageContent}>
          {renderHeader(t.history, () => setScreen('dashboard'))}

          {forecasts.length === 0 ? (
            <View style={styles.whiteCard}>
              <Text style={styles.emptyText}>{t.noForecasts}</Text>
            </View>
          ) : (
            forecasts.map((forecast) => (
              <View key={forecast.id} style={styles.forecastCard}>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedForecast(forecast);
                    setIntegrationPreview('');
                    setIntegrationTarget(null);
                    setScreen('detail');
                  }}
                >
                  <View style={styles.forecastRow}>
                    <Text style={styles.forecastName}>{getForecastDisplayName(forecast, t)}</Text>
                    <Text style={styles.forecastDate}>{forecast.date}</Text>
                  </View>
                  <View style={styles.forecastRow}>
                    <Text style={styles.forecastModel}>
                      {forecast.model === '—'
                        ? t.bestModelPending
                        : forecast.model}
                    </Text>
                    <Text style={styles.forecastAccuracy}>
                      {forecast.accuracy !== null
                        ? `${t.accuracy}: ${forecast.accuracy}%`
                        : t.pendingResults}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteForecast(forecast.id)}
                >
                  <Text style={styles.deleteButtonText}>{t.delete}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          <View style={styles.bottomMenu}>
            <TouchableOpacity onPress={() => setScreen('dashboard')}>
              <Text style={styles.bottomMenuText}>{t.home}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setScreen('history')}>
              <Text style={styles.bottomMenuActive}>{t.history}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
          );
  }

  if (screen === 'detail') {
    content = (
      <View style={styles.pageContainer}>
        <ScrollView contentContainerStyle={styles.pageContent}>
          {renderHeader(t.forecastDetails, () => setScreen('history'))}

          {selectedForecast ? (
            <>
              <View style={styles.whiteCard}>
                <Text style={styles.detailTitle}>
                  {getForecastDisplayName(selectedForecast, t)}
                </Text>
                <Text style={styles.detailItem}>
                  {t.model}:{' '}
                  {selectedForecast.model === '—'
                    ? t.bestModelPending
                    : selectedForecast.model}
                </Text>
                <Text style={styles.detailItem}>
                  {t.date}: {selectedForecast.date}
                </Text>
                <Text style={styles.detailItem}>
                  {t.type}:{' '}
                  {selectedForecast.type === 'automatic'
                    ? t.typeAutomatic
                    : t.typeManual}
                </Text>
                <Text style={styles.detailItem}>
                  {t.study}:{' '}
                  {selectedForecast.studyType === 'univariate'
                    ? t.univariate
                    : t.multivariate}
                </Text>
                <Text style={styles.detailItem}>
                  {t.file}: {selectedForecast.fileName}
                </Text>
                <Text style={styles.detailItem}>
                  {t.forecastHorizon}: {selectedForecast.horizon} {t.periods}
                </Text>
                <Text style={styles.detailItem}>
                  {t.accuracy}:{' '}
                  {selectedForecast.accuracy !== null
                    ? `${selectedForecast.accuracy}%`
                    : '--'}
                </Text>
                <Text style={styles.detailItem}>
                  {getForecastDisplayMessage(selectedForecast, t)}
                </Text>
              </View>

              {selectedForecast.type === 'manual' ? (
                <View style={styles.whiteCard}>
                  <Text style={styles.sectionTitle}>{t.comparisonScope}</Text>
                  <Text style={styles.detailItem}>{t.manualCompareNote}</Text>
                </View>
              ) : null}

              {selectedForecast.estimationSummary ? (
                <View style={styles.whiteCard}>
                  <Text style={styles.sectionTitle}>{t.estimationSummary}</Text>
                  <Text style={styles.detailItem}>R²: --</Text>
                  <Text style={styles.detailItem}>AIC: --</Text>
                  <Text style={styles.detailItem}>BIC: --</Text>
                  <Text style={styles.detailItem}>
                    {selectedForecast.estimationSummary.equation}
                  </Text>
                </View>
              ) : null}

              <View style={styles.whiteCard}>
                <Text style={styles.sectionTitle}>{t.metrics}</Text>
                <Text style={styles.detailItem}>
                  MAE: {selectedForecast.metrics?.mae ?? '--'}
                </Text>
                <Text style={styles.detailItem}>
                  RMSE: {selectedForecast.metrics?.rmse ?? '--'}
                </Text>
                <Text style={styles.detailItem}>
                  {t.mse}: {selectedForecast.metrics?.mse ?? '--'}
                </Text>
              </View>

              <View style={styles.whiteCard}>
  <Text style={styles.sectionTitle}>{t.actualVsPredicted}</Text>

  {selectedForecast.actualSeries.length > 0 &&
  selectedForecast.predictedSeries.length > 0 ? (
    <>
      {renderForecastChart(
        selectedForecast.actualSeries,
        selectedForecast.predictedSeries,
        t
      )}
      <Text style={styles.detailItem}>
        {t.actual}: {selectedForecast.actualSeries.join(' | ')}
      </Text>
      <Text style={styles.detailItem}>
        {t.predicted}: {selectedForecast.predictedSeries.join(' | ')}
      </Text>
    </>
  ) : (
    <View style={styles.chartPlaceholder}>
      <MaterialIcons
        name="show-chart"
        size={54}
        color={palette.textMuted}
      />
      <Text style={styles.chartPendingText}>{t.chartPending}</Text>
      <Text style={styles.emptyText}>{t.noChartData}</Text>
    </View>
  )}
</View>

              <View style={styles.whiteCard}>
                <Text style={styles.sectionTitle}>{t.forecastOutput}</Text>
                <Text style={styles.emptyText}>
                  {selectedForecast.predictions.length > 0
                    ? selectedForecast.predictions.join(' | ')
                    : t.noForecastValues}
                </Text>
              </View>

              <View style={styles.whiteCard}>
                <Text style={styles.sectionTitle}>{t.topModels}</Text>
                <Text style={styles.rankNote}>{t.rankingWillAppear}</Text>

                {selectedForecast.benchmarkSummary.map((entry, index) => (
                  <View key={`${entry.model}-${index}`} style={styles.rankRow}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankBadgeText}>{index + 1}</Text>
                    </View>

                    <View style={styles.rankTextWrap}>
                      <Text style={styles.rankModel}>{entry.model}</Text>
                      <Text style={styles.rankMeta}>
                        {getCategoryLabel(entry.category, t)}
                        {entry.subgroup
                          ? ` | ${getHybridGroupLabel(entry.subgroup, t)}`
                          : ''}
                      </Text>
                      <Text style={styles.rankMeta}>
                        MAE: {entry.mae ?? '--'} | RMSE: {entry.rmse ?? '--'} |{' '}
                        {t.mse}: {entry.mse ?? '--'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
<TouchableOpacity
  style={[styles.primaryButton, { backgroundColor: palette.purple }]}
  onPress={openAnalyticsDashboard}
>
  <Text style={styles.primaryButtonText}>{t.openStreamlitDashboard}</Text>
</TouchableOpacity>
              <View style={styles.whiteCard}>
                <Text style={styles.sectionTitle}>{t.sectorTitle}</Text>

                {selectedForecast.sector ? (
                  <View style={styles.selectedSectorBox}>
                    <Text style={styles.selectedSectorLabel}>
                      {t.selectedSector}
                    </Text>
                    <Text style={styles.selectedSectorValue}>
                      {getSectorLabel(selectedForecast.sector, t)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.detailItem}>{t.chooseSector}</Text>
                )}

                <TouchableOpacity
                  style={[styles.primaryButton, { marginTop: 12 }]}
                  onPress={() => setShowSectorModal(true)}
                >
                  <Text style={styles.primaryButtonText}>{t.chooseSector}</Text>
                </TouchableOpacity>
              </View>

              {selectedForecast.sector ? (
                <>
                  <View style={styles.whiteCard}>
                    <Text style={styles.sectionTitle}>
                      {t.analysisDecisionTitle}
                    </Text>

                    <View style={styles.integrationCard}>
                      <View style={styles.integrationHeader}>
                        <View
                          style={[
                            styles.integrationIcon,
                            { backgroundColor: '#EAF2FF' },
                          ]}
                        >
                          <MaterialIcons
                            name="analytics"
                            size={22}
                            color={palette.royal}
                          />
                        </View>
                        <View style={styles.integrationTextWrap}>
                          <Text style={styles.integrationTitle}>
                            {t.fiddlerTitle}
                          </Text>
                          <Text style={styles.integrationDesc}>
                            {t.fiddlerDesc}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => handleIntegration('fiddler')}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {t.sendToFiddler}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.integrationCard}>
                      <View style={styles.integrationHeader}>
                        <View
                          style={[
                            styles.integrationIcon,
                            { backgroundColor: '#ECFDF3' },
                          ]}
                        >
                          <MaterialIcons
                            name="psychology"
                            size={22}
                            color={palette.green}
                          />
                        </View>
                        <View style={styles.integrationTextWrap}>
                          <Text style={styles.integrationTitle}>
                            {t.datarobotTitle}
                          </Text>
                          <Text style={styles.integrationDesc}>
                            {t.datarobotDesc}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => handleIntegration('datarobot')}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {t.sendToDataRobot}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        { backgroundColor: palette.teal },
                      ]}
                      onPress={() => handleIntegration('package')}
                    >
                      <Text style={styles.primaryButtonText}>
                        {t.preparePackage}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {integrationResult ? (
  renderIntegrationCards()
) : integrationPreview ? (
  <View style={styles.whiteCard}>
    <Text style={styles.sectionTitle}>{t.packagePreview}</Text>

    <Text style={styles.detailItem}>
      {t.variables}: {getStudyVariables(selectedForecast, t).join(', ')}
    </Text>

    <Text style={styles.detailItem}>
      {t.integrationPending}
    </Text>

    <ScrollView horizontal style={styles.payloadBox}>
      <Text style={styles.payloadText}>{integrationPreview}</Text>
    </ScrollView>

    <Text style={styles.payloadFooter}>
      {integrationTarget === 'fiddler'
        ? t.fiddlerTitle
        : integrationTarget === 'datarobot'
        ? t.datarobotTitle
        : t.preparePackage}
    </Text>
  </View>
) : null}
                </>
              ) : null}
            </>
          ) : (
            <View style={styles.whiteCard}>
              <Text style={styles.emptyText}>{t.noData}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <AppShell>
      {content}
      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        t={t}
      />
      <SectorSelectorModal
        visible={showSectorModal}
        onClose={() => setShowSectorModal(false)}
        onSelect={handleSelectSector}
        title={t.chooseSector}
        t={t}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  nativeShell: {
    flex: 1,
    backgroundColor: palette.bgSoft,
  },

  ltrText: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  ltrRow: {
    flexDirection: 'row',
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlInput: {
    textAlign: 'right',
    writingDirection: 'rtl',
    marginLeft: 0,
    marginRight: 10,
  },

  loginContainer: {
    flex: 1,
    backgroundColor: palette.navy,
  },
   decorCircleOne: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(11,99,229,0.22)',
    top: -40,
    left: -60,
  },
  decorCircleTwo: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(244,180,0,0.18)',
    top: 180,
    right: -40,
  },
  decorCircleThree: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(31,165,255,0.14)',
    bottom: 60,
    left: -70,
  },

  loginScroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 56,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },
  topLeftBar: {
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  topBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  topButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  brandArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  brandAreaSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 12,
  },
  appLogo: {
    width: 180,
    height: 180,
    marginBottom: 12,
  },
  logoCircleSmall: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: palette.royal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: palette.white,
    marginBottom: 6,
  },
  brandSubTitle: {
    fontSize: 14,
    color: '#D7E6F7',
  },

  loginCard: {
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 22,
  },
  inputLabel: {
    fontSize: 14,
    color: palette.textDark,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 12,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FAFD',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    minHeight: 54,
    color: palette.textDark,
    fontSize: 15,
    marginLeft: 10,
  },

  primaryButton: {
    backgroundColor: palette.royal,
    borderRadius: 16,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#EEF4FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: palette.textDark,
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#8AA1B8',
  },

  registerRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  registerText: {
    color: palette.textMuted,
    fontSize: 14,
    marginRight: 6,
  },
  registerLink: {
    color: palette.royal,
    fontSize: 14,
    fontWeight: 'bold',
  },

  bottomLanguageWrap: {
    marginTop: 18,
    alignItems: 'center',
  },
  languageTitle: {
    color: palette.white,
    fontSize: 14,
    marginBottom: 10,
    fontWeight: '600',
  },
  languageBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageChip: {
    minWidth: 58,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
  },
  languageChipActive: {
    backgroundColor: palette.gold,
    borderColor: palette.gold,
  },
  languageChipText: {
    color: palette.white,
    fontWeight: '700',
  },
  languageChipTextActive: {
    color: palette.textDark,
  },

  pageContainer: {
    flex: 1,
    backgroundColor: palette.bgSoft,
  },
  pageContent: {
    paddingHorizontal: 18,
    paddingTop: 58,
    paddingBottom: 34,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  headerSideButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSideButtonHidden: {
    opacity: 0,
  },
  pageHeaderTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: 'bold',
    color: palette.textDark,
    textAlign: 'center',
  },

  dashboardTitle: {
    fontSize: 26,
    color: palette.textDark,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dashboardSubtitle: {
    fontSize: 15,
    color: palette.textMuted,
    marginBottom: 20,
  },

  modeCard: {
    backgroundColor: palette.white,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.royal,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modeTextWrap: {
    flex: 1,
  },
  modeTitle: {
    fontSize: 18,
    color: palette.textDark,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  modeDescription: {
    fontSize: 14,
    color: palette.textMuted,
    lineHeight: 20,
  },

  sectionHeader: {
    marginTop: 8,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    color: palette.textDark,
    fontWeight: 'bold',
  },
  viewAllText: {
    color: palette.royal,
    fontWeight: '700',
  },

  forecastCard: {
    backgroundColor: palette.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forecastName: {
    fontSize: 16,
    color: palette.textDark,
    fontWeight: '700',
    flex: 1,
  },
  forecastDate: {
    fontSize: 12,
    color: palette.textMuted,
    marginLeft: 10,
  },
  forecastModel: {
    fontSize: 14,
    color: palette.royal,
    fontWeight: '600',
    flex: 1,
  },
  forecastAccuracy: {
    fontSize: 14,
    color: palette.green,
    fontWeight: '700',
    marginLeft: 8,
  },

  bottomMenu: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: palette.white,
    borderRadius: 18,
    paddingVertical: 16,
    marginTop: 18,
  },
  bottomMenuText: {
    color: palette.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  bottomMenuActive: {
    color: palette.royal,
    fontSize: 15,
    fontWeight: 'bold',
  },

  whiteCard: {
    backgroundColor: palette.white,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    color: palette.textDark,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: palette.textMuted,
    lineHeight: 20,
  },

  studyTypeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  studyTypeButton: {
    width: '48%',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#EEF4FB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  studyTypeButtonActive: {
    backgroundColor: palette.royal,
    borderColor: palette.royal,
  },
  studyTypeButtonText: {
    color: palette.textDark,
    fontWeight: '700',
  },
  studyTypeButtonTextActive: {
    color: palette.white,
  },
  studyInfoText: {
    marginTop: 12,
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },

  fileBox: {
    marginTop: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#B7D2F8',
    backgroundColor: '#F0F7FF',
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  fileText: {
    color: palette.royal,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },

  selectModelButton: {
    backgroundColor: '#F7FAFD',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 16,
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  selectModelButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectModelButtonText: {
    marginLeft: 10,
    color: palette.textDark,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },

  estimationBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#EEF7F1',
    borderWidth: 1,
    borderColor: '#D5EEDF',
  },
  estimationDoneText: {
    color: palette.green,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  estimationText: {
    color: palette.textDark,
    fontSize: 13,
    marginBottom: 4,
    lineHeight: 20,
  },
    categoryCard: {
    backgroundColor: palette.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: palette.royal,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  categoryTextWrap: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 17,
    color: palette.textDark,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  categorySubtitle: {
    fontSize: 13,
    color: palette.textMuted,
    lineHeight: 19,
  },

  searchBox: {
    backgroundColor: palette.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    minHeight: 56,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: palette.textDark,
  },

  groupBlock: {
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: palette.purple,
    marginBottom: 10,
  },

  modelFancyCard: {
    backgroundColor: palette.white,
    borderRadius: 18,
    minHeight: 78,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modelFancyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modelFancyIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modelFancyTextWrap: {
    flex: 1,
  },
  modelFancyTitle: {
    fontSize: 15,
    color: palette.textDark,
    fontWeight: '700',
    marginBottom: 4,
  },
  modelFancySubtitle: {
    fontSize: 12,
    color: palette.textMuted,
  },

  chartPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#F8FBFE',
    minHeight: 180,
    padding: 16,
  },
  chartPendingText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textDark,
    marginTop: 10,
    marginBottom: 8,
  },

  rankRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    backgroundColor: '#F8FBFE',
    padding: 10,
    borderRadius: 14,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.royal,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rankBadgeText: {
    color: palette.white,
    fontWeight: 'bold',
  },
  rankTextWrap: {
    flex: 1,
  },
  rankModel: {
    color: palette.textDark,
    fontWeight: '700',
    marginBottom: 4,
  },
  rankMeta: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 2,
  },
  rankNote: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },

  selectedSectorBox: {
    backgroundColor: '#F7FAFD',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    marginTop: 8,
  },
  selectedSectorLabel: {
    color: palette.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  selectedSectorValue: {
    color: palette.textDark,
    fontWeight: '700',
    fontSize: 15,
  },

  integrationCard: {
    backgroundColor: '#F8FBFE',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E7EEF7',
  },
  integrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  integrationIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  integrationTextWrap: {
    flex: 1,
  },
  integrationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textDark,
    marginBottom: 4,
  },
  integrationDesc: {
    fontSize: 13,
    color: palette.textMuted,
    lineHeight: 19,
  },

  payloadBox: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    padding: 12,
    maxHeight: 260,
  },
  payloadText: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  payloadFooter: {
    marginTop: 10,
    color: palette.teal,
    fontWeight: '700',
  },

  sectorItem: {
    minHeight: 56,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    backgroundColor: '#F8FBFE',
    borderWidth: 1,
    borderColor: '#E7EEF7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectorItemText: {
    color: palette.textDark,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },

  deleteButton: {
    backgroundColor: '#FEECEE',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: palette.danger,
    fontWeight: 'bold',
  },

  emptyText: {
    textAlign: 'center',
    color: palette.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  detailTitle: {
    fontSize: 22,
    color: palette.textDark,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  detailItem: {
    fontSize: 15,
    color: '#36485A',
    marginBottom: 8,
    lineHeight: 22,
  },
chartCard: {
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1,
  borderColor: palette.border,
  borderRadius: 16,
  backgroundColor: '#F8FBFE',
  paddingVertical: 12,
  paddingHorizontal: 8,
  marginTop: 12,
  marginBottom: 12,
},
chartLegendRow: {
  flexDirection: 'row',
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 10,
},
legendItem: {
  flexDirection: 'row',
  alignItems: 'center',
  marginHorizontal: 12,
},
legendDot: {
  width: 10,
  height: 10,
  borderRadius: 5,
  marginRight: 6,
},
legendText: {
  color: palette.textDark,
  fontSize: 12,
  fontWeight: '600',
},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5,17,30,0.35)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: palette.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    minHeight: 420,
    maxHeight: '88%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: palette.textDark,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F3F7FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsLanguageBox: {
    backgroundColor: '#F8FBFE',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E7EEF7',
    padding: 14,
    marginBottom: 12,
  },
  settingsLanguageTitle: {
    fontSize: 15,
    color: palette.textDark,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  settingsLanguageChip: {
    minWidth: 58,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#EEF4FB',
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  settingsLanguageChipText: {
    color: palette.textDark,
    fontWeight: '700',
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF3F8',
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#EEF5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingsItemText: {
    fontSize: 15,
    color: palette.textDark,
    fontWeight: '600',
  },
    integrationSummaryCard: {
    backgroundColor: '#F8FBFE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7EEF7',
    padding: 14,
    marginTop: 12,
  },
  integrationSummaryLabel: {
    color: palette.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  integrationSummaryValue: {
    color: palette.textDark,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  integrationSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  integrationMetricBox: {
    width: '31%',
    backgroundColor: '#F8FBFE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7EEF7',
    padding: 12,
    alignItems: 'center',
  },
  integrationMetricValue: {
    color: palette.royal,
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  decisionCard: {
    backgroundColor: '#ECFDF3',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#B7E4C7',
    padding: 14,
    marginTop: 12,
  },
  decisionTitle: {
    color: palette.green,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  decisionText: {
    color: '#166534',
    fontSize: 14,
    lineHeight: 21,
  },
  integrationNote: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },
});