#!/usr/bin/env python3
"""
Generates and validates Google Play Console translation import packages,
Android localized strings.xml resources, Fastlane store listing metadata,
XLIFF 1.2 (.xlf) archives, CSV spreadsheets, bulk <lang> Release Notes,
and typed frontend translation data for ParserPro (com.receiptscannerpro.app).
"""

import csv
import io
import json
import os
import re
import xml.etree.ElementTree as ET
import zipfile

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

BANNED_TERMS = ["gemini", "google ai studio", "aistudio", "vertex ai", "llm"]

LOCALES = [
    {
        "bcp47": "en-US",
        "android_dir": "values",
        "name": "English (United States)",
        "native_name": "English (US)",
        "region_group": "English & South Africa",
        "title": "ParserPro: Receipt Scanner",
        "short_description": "Scan receipts offline or online, extract items, and track monthly budgets.",
        "full_description": (
            "ParserPro turns paper receipts and digital invoices into clean, organized household expense records in seconds.\n\n"
            "KEY FEATURES\n"
            "• Smart Receipt & Invoice OCR: Snap a photo or import a receipt image to automatically extract store names, dates, totals, taxes, and individual line items.\n"
            "• Offline On-Device Queue: No signal in the store? Queue receipts offline or process them with on-device OCR so you never lose a slip.\n"
            "• Monthly Spending & Category Budgets: Track groceries, utilities, fuel, dining, healthcare, and household spending with clear monthly limits and visual progress.\n"
            "• Line-Item Search & Editing: Search past purchases by store, date, or item description to check price history and edit any entry anytime.\n"
            "• Private Local-First Storage: Your financial records stay stored locally on your device. Export full backups to CSV spreadsheets or JSON files whenever you need them.\n\n"
            "Built for everyday household budgeting, expense tracking, and stress-free receipt organization—with zero ads and zero tracking SDKs."
        ),
        "release_notes": (
            "• Faster receipt and invoice scanning with improved line-item extraction\n"
            "• Offline on-device OCR queue for scanning without internet access\n"
            "• Monthly category budgets, spending charts, and CSV/JSON device backups\n"
            "• Added multi-language support, R8 performance optimization, and stability fixes"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "Smart Receipt Scanner & Expense Tracker",
            "action_scan_receipt": "Scan Receipt",
            "action_offline_queue": "Offline OCR Queue",
            "action_monthly_reports": "Monthly Spending Reports",
            "action_category_budgets": "Category Budgets",
            "action_export_backup": "Export CSV or JSON Backup",
            "privacy_local_storage_notice": "Receipts are stored locally on your device with zero ad tracking.",
        },
    },
    {
        "bcp47": "en-ZA",
        "android_dir": "values-en-rZA",
        "name": "English (South Africa)",
        "native_name": "English (South Africa)",
        "region_group": "English & South Africa",
        "title": "ParserPro: Till Slip Scanner",
        "short_description": "Scan till slips & invoices, extract items in Rands, and track monthly budgets.",
        "full_description": (
            "ParserPro turns supermarket till slips, municipal bills, and invoices into organized household expense records in seconds.\n\n"
            "KEY FEATURES\n"
            "• Smart Till Slip & Invoice OCR: Snap a photo of slips from grocery stores, pharmacies, fuel stations, or hardware retailers to extract vendor names, dates, VAT, totals, and line items in ZAR (R) or other currencies.\n"
            "• Offline On-Device Queue: Queue till slips without mobile data or use on-device OCR anytime—ideal during travel or load-shedding.\n"
            "• Monthly Category Budgets: Set monthly Rand limits for groceries, electricity & utilities, transport, dining, and household essentials.\n"
            "• Item Price History & Search: Search every scanned slip by shop, date, or product name to compare prices month to month.\n"
            "• Private Local Storage & Backups: Your slips stay on your phone with zero ads or tracking SDKs. Export anytime to CSV or JSON."
        ),
        "release_notes": (
            "• Improved till slip and invoice scanning with accurate Rand (ZAR) item extraction\n"
            "• Offline OCR queue so you can capture till slips without mobile data\n"
            "• Monthly category budgets, spending summaries, and CSV/JSON device backups\n"
            "• Added South African & global language support plus R8 performance upgrades"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "Smart Till Slip Scanner & Budget Tracker",
            "action_scan_receipt": "Scan Till Slip",
            "action_offline_queue": "Offline OCR Queue",
            "action_monthly_reports": "Monthly Spending Reports",
            "action_category_budgets": "Category Budgets",
            "action_export_backup": "Export CSV or JSON Backup",
            "privacy_local_storage_notice": "Till slips are stored locally on your phone with zero ad tracking.",
        },
    },
    {
        "bcp47": "en-GB",
        "android_dir": "values-en-rGB",
        "name": "English (United Kingdom)",
        "native_name": "English (UK)",
        "region_group": "English & South Africa",
        "title": "ParserPro: Receipt Scanner",
        "short_description": "Scan receipts & invoices, extract line items, and manage monthly budgets.",
        "full_description": (
            "ParserPro turns paper till receipts and digital invoices into tidy, searchable household expense records in seconds.\n\n"
            "KEY FEATURES\n"
            "• Smart Receipt & Invoice OCR: Photograph or upload any receipt to automatically capture shop names, dates, VAT, totals, and individual line items.\n"
            "• Offline On-Device Queue: Capture receipts without mobile signal and process them offline on your device or when back online.\n"
            "• Monthly Spending & Category Budgets: Monitor groceries, utilities, transport, dining, and household bills with custom monthly targets.\n"
            "• Instant Item Search: Find past purchases by shop, date, or item description in seconds.\n"
            "• Private Local Storage: Your records remain on your device with zero adverts or trackers. Export backups to CSV or JSON anytime."
        ),
        "release_notes": (
            "• Faster receipt and invoice scanning with improved line-item recognition\n"
            "• Offline on-device OCR queue for capturing receipts without signal\n"
            "• Monthly category budgets, spending breakdowns, and CSV/JSON backups\n"
            "• Performance optimisation and stability improvements"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "Smart Receipt Scanner & Expense Tracker",
            "action_scan_receipt": "Scan Receipt",
            "action_offline_queue": "Offline OCR Queue",
            "action_monthly_reports": "Monthly Spending Reports",
            "action_category_budgets": "Category Budgets",
            "action_export_backup": "Export CSV or JSON Backup",
            "privacy_local_storage_notice": "Receipts are stored locally on your device with zero ad tracking.",
        },
    },
    {
        "bcp47": "af",
        "android_dir": "values-af",
        "name": "Afrikaans",
        "native_name": "Afrikaans",
        "region_group": "English & South Africa",
        "title": "ParserPro: Kwitansieskandeer",
        "short_description": "Skandeer strokies en fakture, onttrek items en bestuur maandelikse begrotings.",
        "full_description": (
            "ParserPro verander inkopiestrokies en fakture binne sekondes in netjiese, georganiseerde huishoudelike uitgawerekords.\n\n"
            "HOOFKENMERKE\n"
            "• Slim Strokie- en Faktuur-OCR: Neem 'n foto van enige kasregisterstrokie of faktuur om winkelname, datums, BTW, totale en individuele items outomaties te onttrek.\n"
            "• Aanlyn en Vanlyn OCR-tou: Geen sein in die winkel nie? Stoor strokies in die vanlyn tou of verwerk teks direk op jou toestel.\n"
            "• Maandelikse Begrotings: Stel maandelikse limiete vir kruideniersware, krag en water, brandstof, uiteet en huishoudelike uitgawes in Rand (ZAR) of ander geldeenhede.\n"
            "• Soek en Wysig Items: Soek vinnig deur vorige aankope volgens winkel, datum of itemnaam.\n"
            "• Privaat op jou Toestel: Alle rekords word plaaslik op jou foon gestoor sonder advertensies of opsporing. Voer rugsteune enige tyd uit na CSV of JSON."
        ),
        "release_notes": (
            "• Vinniger skandering van inkopiestrokies en fakture met verbeterde item-herkenning\n"
            "• Vanlyn OCR-tou vir skandering sonder internetverbinding\n"
            "• Maandelikse kategoriebegrotings, bestedingsverslae en CSV/JSON-rugsteun\n"
            "• Afrikaanse taalondersteuning en werkverrigtingverbeterings"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "Slim Strokieskandeerder en Begrotingsbestuurder",
            "action_scan_receipt": "Skandeer Strokie",
            "action_offline_queue": "Vanlyn OCR-tou",
            "action_monthly_reports": "Maandelikse Verslae",
            "action_category_budgets": "Kategoriebegrotings",
            "action_export_backup": "Voer CSV- of JSON-rugsteun uit",
            "privacy_local_storage_notice": "Strokies word plaaslik op jou toestel gestoor sonder advertensie-opsporing.",
        },
    },
    {
        "bcp47": "zu",
        "android_dir": "values-zu",
        "name": "Zulu (isiZulu)",
        "native_name": "isiZulu",
        "region_group": "English & South Africa",
        "title": "ParserPro: Skena Amarisidi",
        "short_description": "Skena amarisidi nama-invoyisi, khipha izinto futhi ulandelele izindleko.",
        "full_description": (
            "I-ParserPro iguqula amarisidi aseveki nama-invoyisi abe amarekhodi ezindleko zasendlini ahlelekile ngemizuzwana.\n\n"
            "IZICI EZIYINHLOKO\n"
            "• Ukuskena Amarisidi Okuhlakaniphile (OCR): Thatha isithombe serisidi noma i-invoyisi ukuze ukhiphe igama lesitolo, usuku, intela, inani eliphelele kanye nezinto ozithengile.\n"
            "• Isebenza Ngaphandle Kwe-inthanethi: Gcina amarisidi ohlwini olungaxhunyiwe ku-inthanethi noma uwacubungule khona manjalo efonini yakho.\n"
            "• Izabelomali Zenyanga: Lawula izindleko zegrosa, ugesi namanzi, uphethiloli kanye nezidingo zasekhaya ngezigaba zenyanga.\n"
            "• Ukusesha Nokuhlela Kalula: Sesha okuthengile ngesitolo, usuku noma igama lento.\n"
            "• Ubumfihlo Obuphelele: Amarekhodi akho agcinwa kudivayisi yakho ngaphandle kwezikhangiso. Khipha isipele se-CSV noma se-JSON noma nini."
        ),
        "release_notes": (
            "• Ukuskena amarisidi nama-invoyisi okusheshayo nokukhipha izinto ngokunembile\n"
            "• Uhlu lwe-OCR olusebenza ngaphandle kwe-inthanethi\n"
            "• Izabelomali zenyanga, imibiko yezindleko kanye nesipele se-CSV/JSON\n"
            "• Ukusekelwa kolimi lwesiZulu nokuthuthukiswa kokusebenza kohlelo"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "Isiskena Samarisidi Nesilawuli Sezindleko",
            "action_scan_receipt": "Skena Irisidi",
            "action_offline_queue": "Uhlu Lwe-OCR Ngaphandle Kwe-inthanethi",
            "action_monthly_reports": "Imibiko Yenyanga",
            "action_category_budgets": "Izabelomali Zezigaba",
            "action_export_backup": "Khipha Isipele se-CSV noma JSON",
            "privacy_local_storage_notice": "Amarisidi agcinwa kudivayisi yakho ngaphandle kokulandelelwa kwezikhangiso.",
        },
    },
    {
        "bcp47": "es-ES",
        "android_dir": "values-es",
        "name": "Spanish (Spain)",
        "native_name": "Español (España)",
        "region_group": "Europe & Americas",
        "title": "ParserPro: Escáner de Tickets",
        "short_description": "Escanea tickets y facturas, extrae artículos y controla tu presupuesto mensual.",
        "full_description": (
            "ParserPro convierte tus tickets de compra y facturas en registros de gastos domésticos claros y organizados en segundos.\n\n"
            "CARACTERÍSTICAS PRINCIPALES\n"
            "• OCR Inteligente de Tickets y Facturas: Haz una foto o importa una imagen para extraer automáticamente comercios, fechas, impuestos, totales y líneas de artículos.\n"
            "• Cola OCR Sin Conexión: Captura tickets sin cobertura y procésalos en el dispositivo o al recuperar la conexión.\n"
            "• Presupuestos Mensuales por Categoría: Controla alimentación, suministros, transporte, restaurantes y hogar con límites mensuales claros.\n"
            "• Búsqueda y Edición Detallada: Busca compras anteriores por tienda, fecha o producto.\n"
            "• Privacidad Local: Tus datos financieros se guardan en tu dispositivo sin anuncios ni rastreadores. Exporta copias en CSV o JSON cuando quieras."
        ),
        "release_notes": (
            "• Escaneo más rápido de tickets y facturas con extracción precisa de artículos\n"
            "• Cola OCR sin conexión para escanear recibos sin internet\n"
            "• Presupuestos mensuales por categoría y exportación de copias en CSV/JSON\n"
            "• Mejoras de rendimiento, estabilidad y soporte multilingüe"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "Escáner de Tickets y Control de Gastos",
            "action_scan_receipt": "Escanear Ticket",
            "action_offline_queue": "Cola OCR Sin Conexión",
            "action_monthly_reports": "Informes Mensuales",
            "action_category_budgets": "Presupuestos por Categoría",
            "action_export_backup": "Exportar Copia CSV o JSON",
            "privacy_local_storage_notice": "Tus tickets se guardan localmente en tu dispositivo sin rastreo publicitario.",
        },
    },
    {
        "bcp47": "es-419",
        "android_dir": "values-b+es+419",
        "name": "Spanish (Latin America)",
        "native_name": "Español (Latinoamérica)",
        "region_group": "Europe & Americas",
        "title": "ParserPro: Escáner de Recibos",
        "short_description": "Escanea recibos y facturas, extrae productos y controla tus gastos mensuales.",
        "full_description": (
            "ParserPro transforma tus recibos de compra y facturas en registros de gastos organizados en segundos.\n\n"
            "FUNCIONES PRINCIPALES\n"
            "• OCR Inteligente de Recibos: Toma una foto de cualquier recibo o factura para extraer tienda, fecha, impuestos, total y cada artículo comprado.\n"
            "• Modo Sin Conexión: Guarda recibos en la cola sin internet o procésalos directamente en tu teléfono.\n"
            "• Presupuestos Mensuales: Define límites mensuales para supermercado, servicios, transporte, salud y hogar.\n"
            "• Historial de Precios y Búsqueda: Encuentra cualquier gasto por comercio, fecha o descripción de producto.\n"
            "• Almacenamiento Local y Privado: Tus recibos permanecen en tu dispositivo sin anuncios ni rastreadores. Exporta respaldos en CSV o JSON en cualquier momento."
        ),
        "release_notes": (
            "• Escaneo mejorado de recibos y facturas con extracción automática de productos\n"
            "• Cola OCR sin conexión para capturar recibos sin datos móviles\n"
            "• Presupuestos mensuales por categoría y respaldos locales en CSV/JSON\n"
            "• Optimización de velocidad y estabilidad general"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "Escáner de Recibos y Control de Gastos",
            "action_scan_receipt": "Escanear Recibo",
            "action_offline_queue": "Cola OCR Sin Conexión",
            "action_monthly_reports": "Reportes Mensuales",
            "action_category_budgets": "Presupuestos por Categoría",
            "action_export_backup": "Exportar Respaldo CSV o JSON",
            "privacy_local_storage_notice": "Los recibos se guardan localmente en tu dispositivo sin seguimiento publicitario.",
        },
    },
    {
        "bcp47": "fr-FR",
        "android_dir": "values-fr",
        "name": "French (France)",
        "native_name": "Français",
        "region_group": "Europe & Americas",
        "title": "ParserPro : Scan de Reçus",
        "short_description": "Scannez reçus et factures, extrayez les articles et suivez votre budget mensuel.",
        "full_description": (
            "ParserPro transforme vos tickets de caisse et factures en relevés de dépenses clairs et organisés en quelques secondes.\n\n"
            "FONCTIONNALITÉS CLÉS\n"
            "• OCR Intelligent de Reçus et Factures : Prenez en photo un ticket pour extraire automatiquement le commerçant, la date, la TVA, le total et chaque article.\n"
            "• File d'attente OCR Hors Ligne : Scannez vos reçus même sans réseau grâce au traitement local sur l'appareil.\n"
            "• Budgets Mensuels par Catégorie : Suivez vos dépenses d'alimentation, d'énergie, de transport et de maison avec des plafonds personnalisés.\n"
            "• Recherche par Article : Retrouvez instantanément vos achats par magasin, date ou produit.\n"
            "• Confidentialité Totale : Vos données restent stockées localement sur votre téléphone, sans publicité ni pistage. Exportez vos sauvegardes en CSV ou JSON."
        ),
        "release_notes": (
            "• Numérisation plus rapide des tickets et factures avec extraction précise des articles\n"
            "• File OCR hors ligne pour scanner vos reçus sans connexion internet\n"
            "• Budgets mensuels par catégorie, graphiques et sauvegardes CSV/JSON\n"
            "• Optimisation des performances et prise en charge multilingue"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "Scanner de Reçus et Suivi de Budget",
            "action_scan_receipt": "Scanner un Reçu",
            "action_offline_queue": "File OCR Hors Ligne",
            "action_monthly_reports": "Rapports Mensuels",
            "action_category_budgets": "Budgets par Catégorie",
            "action_export_backup": "Exporter en CSV ou JSON",
            "privacy_local_storage_notice": "Vos reçus sont stockés localement sur votre appareil sans suivi publicitaire.",
        },
    },
    {
        "bcp47": "de-DE",
        "android_dir": "values-de",
        "name": "German",
        "native_name": "Deutsch",
        "region_group": "Europe & Americas",
        "title": "ParserPro: Belegscanner",
        "short_description": "Kassenbons & Rechnungen scannen, Posten erfassen und Monatsbudgets verwalten.",
        "full_description": (
            "ParserPro verwandelt Kassenbons und Rechnungen sekundenschnell in übersichtliche Haushaltsausgaben.\n\n"
            "HAUPTFUNKTIONEN\n"
            "• Intelligente Beleg- & Rechnungs-OCR: Fotografieren Sie Kassenbons, um Händler, Datum, Steuern, Gesamtsummen und einzelne Positionen automatisch zu erfassen.\n"
            "• Offline-OCR-Warteschlange: Scannen Sie Belege auch ohne Internetverbindung direkt auf Ihrem Gerät.\n"
            "• Monatliche Kategorie-Budgets: Behalten Sie Lebensmittel, Nebenkosten, Tanken und Haushalt mit klaren Monatslimits im Blick.\n"
            "• Artikelsuche & Bearbeitung: Durchsuchen Sie vergangene Einkäufe nach Geschäft, Datum oder Artikel.\n"
            "• Lokaler Datenschutz: Alle Daten bleiben lokal auf Ihrem Smartphone – ohne Werbung und ohne Tracking. Jederzeit als CSV oder JSON exportierbar."
        ),
        "release_notes": (
            "• Schnelleres Scannen von Kassenbons und Rechnungen mit präziser Positionserkennung\n"
            "• Offline-OCR-Warteschlange für das Scannen ohne Internetverbindung\n"
            "• Monatliche Budgets pro Kategorie sowie CSV- und JSON-Backups\n"
            "• Leistungs- und Stabilitätsverbesserungen"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "Intelligenter Belegscanner & Ausgabenplaner",
            "action_scan_receipt": "Beleg scannen",
            "action_offline_queue": "Offline-OCR-Warteschlange",
            "action_monthly_reports": "Monatsberichte",
            "action_category_budgets": "Kategorie-Budgets",
            "action_export_backup": "CSV- oder JSON-Backup exportieren",
            "privacy_local_storage_notice": "Belege werden lokal auf Ihrem Gerät ohne Werbe-Tracking gespeichert.",
        },
    },
    {
        "bcp47": "pt-PT",
        "android_dir": "values-pt",
        "name": "Portuguese (Portugal)",
        "native_name": "Português (Portugal)",
        "region_group": "Europe & Americas",
        "title": "ParserPro: Scanner de Talões",
        "short_description": "Digitalize talões e faturas, extraia artigos e controle o orçamento mensal.",
        "full_description": (
            "O ParserPro transforma talões de compra e faturas em registos de despesas organizados em poucos segundos.\n\n"
            "FUNCIONALIDADES PRINCIPAIS\n"
            "• OCR Inteligente de Talões e Faturas: Fotografe qualquer talão para extrair loja, data, IVA, total e cada artigo automaticamente.\n"
            "• Fila OCR Offline: Registe talões sem ligação à internet e processe-os diretamente no telemóvel.\n"
            "• Orçamentos Mensais por Categoria: Acompanhe supermercado, serviços, combustível e despesas domésticas.\n"
            "• Pesquisa Rápida de Artigos: Encontre compras anteriores por comerciante, data ou descrição.\n"
            "• Privacidade Local: Os seus dados ficam guardados no dispositivo, sem anúncios nem rastreio. Exporte cópias em CSV ou JSON."
        ),
        "release_notes": (
            "• Leitura mais rápida de talões e faturas com extração detalhada de artigos\n"
            "• Fila OCR offline para digitalizar recibos sem acesso à internet\n"
            "• Orçamentos mensais por categoria e exportação de cópias em CSV/JSON\n"
            "• Melhorias de desempenho e estabilidade"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "Scanner de Talões e Gestor de Despesas",
            "action_scan_receipt": "Digitalizar Talão",
            "action_offline_queue": "Fila OCR Offline",
            "action_monthly_reports": "Relatórios Mensais",
            "action_category_budgets": "Orçamentos por Categoria",
            "action_export_backup": "Exportar Cópia CSV ou JSON",
            "privacy_local_storage_notice": "Os talões são guardados localmente no dispositivo sem rastreio publicitário.",
        },
    },
    {
        "bcp47": "pt-BR",
        "android_dir": "values-pt-rBR",
        "name": "Portuguese (Brazil)",
        "native_name": "Português (Brasil)",
        "region_group": "Europe & Americas",
        "title": "ParserPro: Scanner de Recibos",
        "short_description": "Escaneie recibos e notas, extraia itens e controle seu orçamento mensal.",
        "full_description": (
            "O ParserPro transforma cupons fiscais, recibos e faturas em registros de despesas domésticas organizados em segundos.\n\n"
            "PRINCIPAIS RECURSOS\n"
            "• OCR Inteligente de Recibos: Tire uma foto do comprovante para extrair automaticamente estabelecimento, data, impostos, valor total e itens comprados.\n"
            "• Fila OCR Offline: Sem internet na loja? Salve recibos na fila offline ou processe direto no aparelho.\n"
            "• Orçamento Mensal por Categoria: Defina metas para mercado, contas, combustível, saúde e lazer.\n"
            "• Busca por Produto: Pesquise compras passadas por loja, data ou nome do item.\n"
            "• Privacidade no Aparelho: Seus dados ficam salvos localmente no celular, sem anúncios ou rastreadores. Exporte backups em CSV ou JSON quando quiser."
        ),
        "release_notes": (
            "• Escaneamento mais rápido de recibos e notas com extração precisa de itens\n"
            "• Fila OCR offline para capturar comprovantes sem conexão com a internet\n"
            "• Orçamentos mensais por categoria e backups completos em CSV/JSON\n"
            "• Otimização de desempenho e melhorias de estabilidade"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "Scanner de Recibos e Controle de Gastos",
            "action_scan_receipt": "Escanear Recibo",
            "action_offline_queue": "Fila OCR Offline",
            "action_monthly_reports": "Relatórios Mensais",
            "action_category_budgets": "Orçamentos por Categoria",
            "action_export_backup": "Exportar Backup CSV ou JSON",
            "privacy_local_storage_notice": "Seus recibos ficam salvos localmente no aparelho sem rastreamento de anúncios.",
        },
    },
    {
        "bcp47": "nl-NL",
        "android_dir": "values-nl",
        "name": "Dutch",
        "native_name": "Nederlands",
        "region_group": "Europe & Americas",
        "title": "ParserPro: Bonnenscanner",
        "short_description": "Scan kassabonnen en facturen, herken artikelen en beheer je maandbudget.",
        "full_description": (
            "ParserPro zet papieren kassabonnen en digitale facturen binnen enkele seconden om in overzichtelijke uitgavenoverzichten.\n\n"
            "BELANGRIJKSTE FUNCTIES\n"
            "• Slimme Bon- & Factuur-OCR: Maak een foto van je bon om winkelnaam, datum, btw, totaalbedrag en losse artikelen automatisch uit te lezen.\n"
            "• Offline OCR-wachtrij: Geen bereik in de winkel? Scan bonnen offline en verwerk ze direct op je toestel.\n"
            "• Maandbudgetten per Categorie: Stel limieten in voor boodschappen, energie, vervoer en huishouden.\n"
            "• Snel Zoeken & Bewerken: Doorzoek eerdere aankopen op winkel, datum of productnaam.\n"
            "• Lokale Privacy: Al je gegevens blijven lokaal op je telefoon staan, zonder advertenties of trackers. Exporteer back-ups naar CSV of JSON."
        ),
        "release_notes": (
            "• Sneller kassabonnen en facturen scannen met verbeterde artikelherkenning\n"
            "• Offline OCR-wachtrij voor scannen zonder internetverbinding\n"
            "• Maandbudgetten per categorie en CSV/JSON-back-ups op je toestel\n"
            "• Prestatie- en stabiliteitsverbeteringen"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "Slimme Bonnenscanner & Budgetbeheer",
            "action_scan_receipt": "Bon Scannen",
            "action_offline_queue": "Offline OCR-wachtrij",
            "action_monthly_reports": "Maandoverzichten",
            "action_category_budgets": "Categoriebudgetten",
            "action_export_backup": "CSV- of JSON-back-up exporteren",
            "privacy_local_storage_notice": "Bonnen worden lokaal op je toestel opgeslagen zonder advertentietracking.",
        },
    },
    {
        "bcp47": "it-IT",
        "android_dir": "values-it",
        "name": "Italian",
        "native_name": "Italiano",
        "region_group": "Europe & Americas",
        "title": "ParserPro: Scanner Scontrini",
        "short_description": "Scansiona scontrini e fatture, estrai gli articoli e gestisci il budget mensile.",
        "full_description": (
            "ParserPro trasforma scontrini cartacei e fatture in registri di spesa domestica ordinati in pochi secondi.\n\n"
            "CARATTERISTICHE PRINCIPALI\n"
            "• OCR Intelligente per Scontrini e Fatture: Scatta una foto per estrarre automaticamente negozio, data, IVA, totale e singoli articoli.\n"
            "• Coda OCR Offline: Acquisisci gli scontrini anche senza connessione internet grazie all'elaborazione sul dispositivo.\n"
            "• Budget Mensili per Categoria: Tieni sotto controllo spesa alimentare, bollette, carburante e casa.\n"
            "• Ricerca Rapida Articoli: Cerca gli acquisti passati per negozio, data o descrizione prodotto.\n"
            "• Privacy Locale: I tuoi dati restano salvati sul telefono senza pubblicità né tracciamento. Esporta backup in CSV o JSON in qualsiasi momento."
        ),
        "release_notes": (
            "• Scansione più rapida di scontrini e fatture con estrazione precisa degli articoli\n"
            "• Coda OCR offline per acquisire ricevute senza connessione internet\n"
            "• Budget mensili per categoria ed esportazione backup in CSV/JSON\n"
            "• Miglioramenti alle prestazioni e alla stabilità"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "Scanner Scontrini e Gestione Spese",
            "action_scan_receipt": "Scansiona Scontrino",
            "action_offline_queue": "Coda OCR Offline",
            "action_monthly_reports": "Report Mensili",
            "action_category_budgets": "Budget per Categoria",
            "action_export_backup": "Esporta Backup CSV o JSON",
            "privacy_local_storage_notice": "Gli scontrini sono salvati localmente sul dispositivo senza tracciamento pubblicitario.",
        },
    },
    {
        "bcp47": "ar",
        "android_dir": "values-ar",
        "name": "Arabic",
        "native_name": "العربية",
        "region_group": "Middle East & Asia",
        "title": "ParserPro: ماسح الإيصالات",
        "short_description": "امسح الإيصالات والفواتير ضوئياً واستخرج المشتريات وتابع ميزانيتك الشهرية.",
        "full_description": (
            "يحوّل تطبيق ParserPro إيصالات الشراء والفواتير الورقية إلى سجلات مصروفات منزلية منظمة خلال ثوانٍ.\n\n"
            "المميزات الرئيسية\n"
            "• مسح ذكي للإيصالات والفواتير (OCR): التقط صورة لأي إيصال لاستخراج اسم المتجر والتاريخ والضريبة والإجمالي وقائمة الأصناف تلقائياً.\n"
            "• العمل دون إنترنت: احفظ الإيصالات في قائمة الانتظار دون اتصال أو عالجها مباشرة على جهازك.\n"
            "• ميزانيات شهرية حسب الفئة: راقب نفقات البقالة والفواتير والوقود والمنزل بحدود شهرية واضحة.\n"
            "• بحث وتعديل سريع: ابحث في مشترياتك السابقة حسب المتجر أو التاريخ أو اسم المنتج.\n"
            "• خصوصية تامة على جهازك: تُحفظ جميع بياناتك محلياً على هاتفك بدون إعلانات أو أدوات تتبع، مع إمكانية التصدير إلى CSV أو JSON."
        ),
        "release_notes": (
            "• تسريع مسح الإيصالات والفواتير وتحسين دقة استخراج الأصناف\n"
            "• قائمة انتظار OCR للعمل دون اتصال بالإنترنت\n"
            "• ميزانيات شهرية حسب الفئة وتقارير إنفاق ونسخ احتياطي بصيغة CSV وJSON\n"
            "• دعم اللغات المتعددة وتحسين الأداء والاستقرار"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "ماسح الإيصالات الذكي ومتتبع المصروفات",
            "action_scan_receipt": "مسح إيصال",
            "action_offline_queue": "قائمة OCR دون إنترنت",
            "action_monthly_reports": "التقارير الشهرية",
            "action_category_budgets": "ميزانيات الفئات",
            "action_export_backup": "تصدير نسخة احتياطية CSV أو JSON",
            "privacy_local_storage_notice": "تُحفظ الإيصالات محلياً على جهازك دون أي تتبع إعلاني.",
        },
    },
    {
        "bcp47": "hi-IN",
        "android_dir": "values-hi",
        "name": "Hindi",
        "native_name": "हिन्दी",
        "region_group": "Middle East & Asia",
        "title": "ParserPro: रसीद स्कैनर",
        "short_description": "रसीदें और बिल स्कैन करें, आइटम निकालें और अपने मासिक बजट को ट्रैक करें।",
        "full_description": (
            "ParserPro कुछ ही सेकंड में कागज़ी रसीदों और बिलों को व्यवस्थित घरेलू खर्च रिकॉर्ड में बदल देता है।\n\n"
            "मुख्य विशेषताएँ\n"
            "• स्मार्ट रसीद और इनवॉइस OCR: दुकान का नाम, तारीख, टैक्स, कुल राशि और हर आइटम अपने-आप निकालने के लिए रसीद की फ़ोटो लें।\n"
            "• ऑफ़लाइन OCR कतार: इंटरनेट न होने पर भी रसीदें सेव करें और सीधे अपने फ़ोन पर प्रोसेस करें।\n"
            "• मासिक श्रेणी बजट: राशन, बिजली-पानी, ईंधन और घरेलू खर्चों के लिए मासिक बजट सीमा तय करें।\n"
            "• आइटम खोज और संपादन: दुकान, तारीख या सामान के नाम से पुराने खर्च तुरंत खोजें।\n"
            "• पूरी गोपनीयता: आपका डेटा बिना किसी विज्ञापन या ट्रैकिंग के आपके फ़ोन पर सुरक्षित रहता है। कभी भी CSV या JSON में बैकअप लें।"
        ),
        "release_notes": (
            "• तेज़ रसीद और बिल स्कैनिंग तथा बेहतर आइटम पहचान\n"
            "• बिना इंटरनेट स्कैनिंग के लिए ऑफ़लाइन OCR कतार\n"
            "• मासिक श्रेणी बजट, खर्च रिपोर्ट और CSV/JSON बैकअप\n"
            "• बहुभाषी समर्थन और बेहतर प्रदर्शन"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "स्मार्ट रसीद स्कैनर और खर्च ट्रैकर",
            "action_scan_receipt": "रसीद स्कैन करें",
            "action_offline_queue": "ऑफ़लाइन OCR कतार",
            "action_monthly_reports": "मासिक खर्च रिपोर्ट",
            "action_category_budgets": "श्रेणी बजट",
            "action_export_backup": "CSV या JSON बैकअप निर्यात करें",
            "privacy_local_storage_notice": "आपकी रसीदें बिना किसी विज्ञापन ट्रैकिंग के आपके डिवाइस पर सुरक्षित रहती हैं।",
        },
    },
    {
        "bcp47": "zh-CN",
        "android_dir": "values-zh-rCN",
        "name": "Chinese (Simplified)",
        "native_name": "简体中文",
        "region_group": "Middle East & Asia",
        "title": "ParserPro：小票与发票扫描",
        "short_description": "离线或在线扫描购物小票与发票，自动提取明细并管理每月分类预算。",
        "full_description": (
            "ParserPro 可在几秒钟内将纸质购物小票和电子发票转化为清晰有序的家庭支出记录。\n\n"
            "核心功能\n"
            "• 智能小票与发票 OCR：拍照或导入图片，即可自动识别商户名称、日期、税额、总金额及每项商品明细。\n"
            "• 离线本地识别队列：没有网络也能随时拍摄保存小票，并通过设备本地 OCR 完成识别。\n"
            "• 每月分类预算管理：为超市购物、水电煤气、交通燃油、餐饮和日常家用设置月度预算上限。\n"
            "• 商品明细搜索与编辑：按商店、日期或商品名称快速查找历史价格与消费记录。\n"
            "• 本地隐私存储：所有账单数据均保存在您的手机本地，无广告、无追踪 SDK，支持随时导出 CSV 表格或 JSON 备份。"
        ),
        "release_notes": (
            "• 提升购物小票与发票扫描速度，优化商品明细提取准确度\n"
            "• 支持无网络环境下的离线本地 OCR 扫描队列\n"
            "• 提供每月分类预算、支出图表及 CSV/JSON 本地备份导出\n"
            "• 新增多语言支持并优化整体性能与稳定性"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "智能小票扫描与月度预算管家",
            "action_scan_receipt": "扫描小票",
            "action_offline_queue": "离线 OCR 队列",
            "action_monthly_reports": "月度支出报表",
            "action_category_budgets": "分类预算",
            "action_export_backup": "导出 CSV 或 JSON 备份",
            "privacy_local_storage_notice": "所有小票仅保存在您的设备本地，无任何广告追踪。",
        },
    },
    {
        "bcp47": "ja-JP",
        "android_dir": "values-ja",
        "name": "Japanese",
        "native_name": "日本語",
        "region_group": "Middle East & Asia",
        "title": "ParserPro: レシートスキャナー",
        "short_description": "レシートや請求書をOCR読取。品目を自動抽出し毎月の家計予算をかんたん管理。",
        "full_description": (
            "ParserProは、紙のレシートや請求書を数秒で整理された家計簿データに変換するスマート支出管理アプリです。\n\n"
            "主な機能\n"
            "• 高精度レシート・請求書OCR：レシートを撮影するだけで、店舗名・日付・税金・合計金額・購入品目を自動抽出します。\n"
            "• オフラインOCRキュー：電波のない場所でもレシートを保存し、端末内OCRでいつでも処理できます。\n"
            "• カテゴリ別の月間予算管理：食料品、光熱費、交通費、日用品などの月間予算を設定し、支出状況をひと目で把握。\n"
            "• 品目検索・編集：店名や日付、商品名から過去の購入履歴や価格をすばやく検索。\n"
            "• 安心の端末内保存：データはスマートフォン内に保存され、広告やトラッキングSDKは一切ありません。CSVやJSON形式でいつでもバックアップ可能です。"
        ),
        "release_notes": (
            "• レシート・請求書のスキャン速度と品目抽出の精度を向上\n"
            "• 圏外でも使えるオフライン端末内OCRキューに対応\n"
            "• カテゴリ別の月間予算管理とCSV/JSONバックアップ機能を搭載\n"
            "• 多言語サポートの追加および動作の安定性向上"
        ),
        "ui_strings": {
            "app_name": "ParserPro",
            "title_activity_main": "ParserPro",
            "app_tagline": "スマートレシート読取＆家計予算管理",
            "action_scan_receipt": "レシート読取",
            "action_offline_queue": "オフラインOCRキュー",
            "action_monthly_reports": "月間支出レポート",
            "action_category_budgets": "カテゴリ予算",
            "action_export_backup": "CSV / JSONバックアップ出力",
            "privacy_local_storage_notice": "レシートは端末内に保存され、広告トラッキングは一切行われません。",
        },
    },
]


def escape_android_xml_text(text: str) -> str:
    """Escapes text for Android aapt2 strings.xml (<string> value)."""
    escaped = (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("'", "\\'")
        .replace('"', '\\"')
        .replace("\n", "\\n")
    )
    return escaped


def escape_standard_xml_text(text: str) -> str:
    """Escapes text for standard XML / XLIFF 1.2."""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def validate_all_locales():
    seen_codes = set()
    for loc in LOCALES:
        code = loc["bcp47"]
        assert code not in seen_codes, f"Duplicate locale code: {code}"
        seen_codes.add(code)

        t_len = len(loc["title"])
        s_len = len(loc["short_description"])
        f_len = len(loc["full_description"])
        r_len = len(loc["release_notes"])

        assert 1 <= t_len <= 30, f"[{code}] Title length {t_len} exceeds 30 chars: {loc['title']}"
        assert 1 <= s_len <= 80, f"[{code}] Short description length {s_len} exceeds 80 chars: {loc['short_description']}"
        assert 1 <= f_len <= 4000, f"[{code}] Full description length {f_len} exceeds 4000 chars"
        assert 1 <= r_len <= 500, f"[{code}] Release notes length {r_len} exceeds 500 chars ({r_len})"

        combined_blob = " ".join([
            loc["title"],
            loc["short_description"],
            loc["full_description"],
            loc["release_notes"],
            *loc["ui_strings"].values(),
        ]).lower()
        for banned in BANNED_TERMS:
            assert banned not in combined_blob, f"[{code}] Contains banned internal term '{banned}'"


def build_android_strings_xml(loc: dict, include_untranslatable: bool) -> str:
    lines = ["<?xml version='1.0' encoding='utf-8'?>", "<resources>"]
    for key, val in loc["ui_strings"].items():
        lines.append(f'    <string name="{key}">{escape_android_xml_text(val)}</string>')
    if include_untranslatable:
        lines.append('    <string name="package_name" translatable="false">com.receiptscannerpro.app</string>')
        lines.append('    <string name="custom_url_scheme" translatable="false">com.receiptscannerpro.app</string>')
    lines.append("</resources>")
    xml_content = "\n".join(lines) + "\n"

    # Parse with ElementTree to guarantee well-formed XML
    root = ET.fromstring(xml_content)
    for child in root.findall("string"):
        raw_val = child.text or ""
        assert not re.search(r"(?<!\\)'", raw_val), f"Unescaped apostrophe in {loc['bcp47']}:{child.attrib.get('name')}"
    return xml_content


def build_xliff_12(source_loc: dict, target_loc: dict) -> str:
    src_code = source_loc["bcp47"]
    tgt_code = target_loc["bcp47"]
    units = [
        ("title", "App Title (max 30 chars)", source_loc["title"], target_loc["title"]),
        ("short_description", "Short Description (max 80 chars)", source_loc["short_description"], target_loc["short_description"]),
        ("full_description", "Full Description (max 4000 chars)", source_loc["full_description"], target_loc["full_description"]),
        ("whats_new", "Release Notes (max 500 chars)", source_loc["release_notes"], target_loc["release_notes"]),
    ]
    for key, src_val in source_loc["ui_strings"].items():
        units.append((f"app_string.{key}", f"Android UI String: {key}", src_val, target_loc["ui_strings"][key]))

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">',
        f'  <file original="com.receiptscannerpro.app" datatype="plaintext" source-language="{src_code}" target-language="{tgt_code}">',
        "    <body>",
    ]
    for unit_id, note, src_text, tgt_text in units:
        lines.append(f'      <trans-unit id="{unit_id}">')
        lines.append(f"        <source>{escape_standard_xml_text(src_text)}</source>")
        lines.append(f'        <target state="translated">{escape_standard_xml_text(tgt_text)}</target>')
        lines.append(f"        <note>{escape_standard_xml_text(note)}</note>")
        lines.append("      </trans-unit>")
    lines.extend([
        "    </body>",
        "  </file>",
        "</xliff>",
    ])
    xlf = "\n".join(lines) + "\n"
    ET.fromstring(xlf)
    return xlf


def main():
    validate_all_locales()

    res_root = os.path.join(ROOT_DIR, "android", "app", "src", "main", "res")
    public_out = os.path.join(ROOT_DIR, "public", "play-console-translations")
    fastlane_root = os.path.join(ROOT_DIR, "fastlane", "metadata", "android")
    os.makedirs(public_out, exist_ok=True)
    os.makedirs(fastlane_root, exist_ok=True)

    # 1. Write Android res/values*/strings.xml + locales_config.xml + raw/keep.xml
    app_strings_zip_path = os.path.join(public_out, "play-console-app-strings.zip")
    with zipfile.ZipFile(app_strings_zip_path, "w", zipfile.ZIP_DEFLATED) as zf_strings:
        for loc in LOCALES:
            is_default = loc["android_dir"] == "values"
            xml_str = build_android_strings_xml(loc, include_untranslatable=is_default)
            target_dir = os.path.join(res_root, loc["android_dir"])
            os.makedirs(target_dir, exist_ok=True)
            with open(os.path.join(target_dir, "strings.xml"), "w", encoding="utf-8") as f:
                f.write(xml_str)
            zf_strings.writestr(f"res/{loc['android_dir']}/strings.xml", xml_str)

    # Write Android 13+ locales_config.xml
    xml_dir = os.path.join(res_root, "xml")
    os.makedirs(xml_dir, exist_ok=True)
    locales_cfg_lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<locale-config xmlns:android="http://schemas.android.com/apk/res/android">',
    ]
    for loc in LOCALES:
        locales_cfg_lines.append(f'    <locale android:name="{loc["bcp47"]}" />')
    locales_cfg_lines.append("</locale-config>\n")
    locales_cfg_xml = "\n".join(locales_cfg_lines)
    ET.fromstring(locales_cfg_xml)
    with open(os.path.join(xml_dir, "locales_config.xml"), "w", encoding="utf-8") as f:
        f.write(locales_cfg_xml)

    # Write res/raw/keep.xml so R8 shrinkResources preserves all localized strings & locale config
    raw_dir = os.path.join(res_root, "raw")
    os.makedirs(raw_dir, exist_ok=True)
    keep_xml = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<resources xmlns:tools="http://schemas.android.com/tools"\n'
        '    tools:keep="@string/*,@xml/locales_config" />\n'
    )
    ET.fromstring(keep_xml)
    with open(os.path.join(raw_dir, "keep.xml"), "w", encoding="utf-8") as f:
        f.write(keep_xml)

    # 2. Write Bulk Release Notes (<bcp47>...</bcp47>) files
    release_notes_blocks = []
    en_only_blocks = []
    for loc in LOCALES:
        block = f"<{loc['bcp47']}>\n{loc['release_notes']}\n</{loc['bcp47']}>"
        release_notes_blocks.append(block)
        if loc["bcp47"].startswith("en-") or loc["bcp47"] in ("af", "zu"):
            en_only_blocks.append(block)

    all_release_notes_txt = "\n\n".join(release_notes_blocks) + "\n"
    za_release_notes_txt = "\n\n".join(en_only_blocks) + "\n"

    with open(os.path.join(public_out, "play-console-release-notes.txt"), "w", encoding="utf-8") as f:
        f.write(all_release_notes_txt)
    with open(os.path.join(public_out, "play-console-release-notes-za-en.txt"), "w", encoding="utf-8") as f:
        f.write(za_release_notes_txt)

    # 3. Write CSV Store Listing Spreadsheet
    csv_path = os.path.join(public_out, "play-console-store-listings.csv")
    csv_buf = io.StringIO()
    writer = csv.writer(csv_buf)
    writer.writerow([
        "Language Code (BCP-47)",
        "Language Name",
        "Title (Max 30 Chars)",
        "Title Chars",
        "Short Description (Max 80 Chars)",
        "Short Desc Chars",
        "Full Description (Max 4000 Chars)",
        "Full Desc Chars",
        "Release Notes (Max 500 Chars)",
        "Release Notes Chars",
    ])
    for loc in LOCALES:
        writer.writerow([
            loc["bcp47"],
            loc["name"],
            loc["title"],
            len(loc["title"]),
            loc["short_description"],
            len(loc["short_description"]),
            loc["full_description"],
            len(loc["full_description"]),
            loc["release_notes"],
            len(loc["release_notes"]),
        ])
    csv_bytes = csv_buf.getvalue().encode("utf-8")
    with open(csv_path, "wb") as f:
        f.write(csv_bytes)

    # 4. Write XLIFF 1.2 (.xlf) Store Listing + App Strings Archive
    source_loc = LOCALES[0]
    xliff_zip_path = os.path.join(public_out, "play-console-store-listings-xliff.zip")
    with zipfile.ZipFile(xliff_zip_path, "w", zipfile.ZIP_DEFLATED) as zf_xliff:
        for loc in LOCALES:
            xlf_str = build_xliff_12(source_loc, loc)
            zf_xliff.writestr(f"com.receiptscannerpro.app_{loc['bcp47']}.xlf", xlf_str)

    # 5. Write Fastlane / Triple-T Play Publisher Metadata Directory & ZIP
    fastlane_zip_path = os.path.join(public_out, "play-console-fastlane-metadata.zip")
    with zipfile.ZipFile(fastlane_zip_path, "w", zipfile.ZIP_DEFLATED) as zf_fastlane:
        for loc in LOCALES:
            code = loc["bcp47"]
            loc_dir = os.path.join(fastlane_root, code)
            changelogs_dir = os.path.join(loc_dir, "changelogs")
            os.makedirs(changelogs_dir, exist_ok=True)

            files_map = {
                "title.txt": loc["title"] + "\n",
                "short_description.txt": loc["short_description"] + "\n",
                "full_description.txt": loc["full_description"] + "\n",
                "changelogs/default.txt": loc["release_notes"] + "\n",
                "changelogs/130.txt": loc["release_notes"] + "\n",
            }
            for rel_name, content in files_map.items():
                disk_path = os.path.join(loc_dir, rel_name)
                os.makedirs(os.path.dirname(disk_path), exist_ok=True)
                with open(disk_path, "w", encoding="utf-8") as f:
                    f.write(content)
                zf_fastlane.writestr(f"metadata/android/{code}/{rel_name}", content)

    # 6. Write Master All-In-One Bundle ZIP with step-by-step instructions
    readme_txt = (
        "ParserPro (com.receiptscannerpro.app) — Google Play Console Translations Package\n"
        "================================================================================\n\n"
        "Included Locales (17 Official Google Play Console BCP-47 Codes):\n"
        "en-US, en-ZA, en-GB, af, zu, es-ES, es-419, fr-FR, de-DE, pt-PT, pt-BR, nl-NL, it-IT, ar, hi-IN, zh-CN, ja-JP\n\n"
        "HOW TO IMPORT INTO GOOGLE PLAY CONSOLE:\n\n"
        "1. App UI Strings (Play Console -> Grow -> Translations -> App strings):\n"
        "   - Upload 'play-console-app-strings.zip' (contains res/values-<locale>/strings.xml).\n"
        "   - Note: These 17 locales are ALSO compiled directly into your next .aab bundle!\n\n"
        "2. Release Notes Bulk Import (Play Console -> Testing/Production -> Create/Edit release -> Release notes):\n"
        "   - Open 'play-console-release-notes.txt', copy the <lang>...</lang> blocks, and paste directly\n"
        "     into the Release notes box. Play Console automatically splits every language tag.\n"
        "   - Make sure any language tags you paste are added under Store Listing -> Manage translations first.\n\n"
        "3. Main Store Listing Translations (Play Console -> Grow -> Store presence -> Main store listing):\n"
        "   - Click 'Manage translations' -> 'Add translations' and select the languages you want.\n"
        "   - Use 'play-console-store-listings.csv', 'play-console-store-listings-xliff.zip' (XLIFF 1.2),\n"
        "     or 'play-console-fastlane-metadata.zip' (Fastlane supply / Gradle Play Publisher API),\n"
        "     or copy Title (<=30 chars), Short Description (<=80 chars), and Full Description (<=4000 chars)\n"
        "     with 1 tap inside ParserPro -> Settings -> Play Console Translations.\n"
    )
    with open(os.path.join(public_out, "HOW-TO-IMPORT.txt"), "w", encoding="utf-8") as f:
        f.write(readme_txt)

    master_zip_path = os.path.join(public_out, "play-console-translations-bundle.zip")
    with zipfile.ZipFile(master_zip_path, "w", zipfile.ZIP_DEFLATED) as zf_master:
        zf_master.writestr("HOW-TO-IMPORT.txt", readme_txt)
        zf_master.write(app_strings_zip_path, "play-console-app-strings.zip")
        zf_master.write(xliff_zip_path, "play-console-store-listings-xliff.zip")
        zf_master.write(fastlane_zip_path, "play-console-fastlane-metadata.zip")
        zf_master.write(csv_path, "play-console-store-listings.csv")
        zf_master.writestr("play-console-release-notes.txt", all_release_notes_txt)
        zf_master.writestr("play-console-release-notes-za-en.txt", za_release_notes_txt)

    # 7. Write TypeScript data module for 1-tap mobile copying & downloading inside SettingsView
    ts_data_dir = os.path.join(ROOT_DIR, "src", "data")
    os.makedirs(ts_data_dir, exist_ok=True)
    ts_payload = [
        {
            "bcp47": loc["bcp47"],
            "androidDir": loc["android_dir"],
            "name": loc["name"],
            "nativeName": loc["native_name"],
            "regionGroup": loc["region_group"],
            "title": loc["title"],
            "shortDescription": loc["short_description"],
            "fullDescription": loc["full_description"],
            "releaseNotes": loc["release_notes"],
        }
        for loc in LOCALES
    ]
    ts_file_content = (
        "// Auto-generated by scripts/generate-play-translations.py — verified against Play Console limits\n"
        "export interface PlayConsoleLocaleTranslation {\n"
        "  bcp47: string;\n"
        "  androidDir: string;\n"
        "  name: string;\n"
        "  nativeName: string;\n"
        "  regionGroup: string;\n"
        "  title: string;\n"
        "  shortDescription: string;\n"
        "  fullDescription: string;\n"
        "  releaseNotes: string;\n"
        "}\n\n"
        f"export const PLAY_CONSOLE_TRANSLATIONS: PlayConsoleLocaleTranslation[] = {json.dumps(ts_payload, ensure_ascii=False, indent=2)};\n\n"
        f"export const BULK_RELEASE_NOTES_ALL_17 = {json.dumps(all_release_notes_txt.strip(), ensure_ascii=False)};\n\n"
        f"export const BULK_RELEASE_NOTES_ZA_EN = {json.dumps(za_release_notes_txt.strip(), ensure_ascii=False)};\n"
    )
    with open(os.path.join(ts_data_dir, "playConsoleTranslations.ts"), "w", encoding="utf-8") as f:
        f.write(ts_file_content)

    print(f"Successfully generated and validated {len(LOCALES)} Google Play Console locales:")
    for loc in LOCALES:
        print(
            f"  - {loc['bcp47']:7s} ({loc['android_dir']:15s}) | "
            f"Title: {len(loc['title']):2d}/30 | "
            f"Short: {len(loc['short_description']):2d}/80 | "
            f"Full: {len(loc['full_description']):4d}/4000 | "
            f"Notes: {len(loc['release_notes']):3d}/500"
        )


if __name__ == "__main__":
    main()
