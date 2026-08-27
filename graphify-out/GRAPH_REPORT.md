# Graph Report - multi-forge  (2026-08-27)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 3177 nodes · 6462 edges · 200 communities (169 shown, 31 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 194 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `297858ab`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- utils/index.ts
- Ext4Inode
- cache.rs
- Path
- academic_db.py
- AcademicDataSource
- DownloadState
- useTauri.ts
- logging/mod.rs
- CacheService
- Settings
- ResolvedQdl
- types/index.ts
- Ext4
- Ext4Superblock
- custom_image.rs
- webrtc_apm/__init__.py
- EventRepository
- STTClient
- GuiDisplay
- LayoutConfigModel
- AutoconfigSection.tsx
- config/index.ts
- api/main.py
- Ext4DirEntry
- ActivationWindow
- AppearanceSection.tsx
- ConfigManager
- TTSClient
- AudioWidget
- dependencies
- devDependencies
- Ext4ExtentHeader
- ManufacturerPanel.tsx
- UpdateModal.tsx
- SettingsWindow
- picture_cache.rs
- flash.rs
- FlashProgress.tsx
- compilerOptions
- WakeWordWidget
- BaseSettingsWidget
- macos.rs
- Ext4
- DevicePanel.tsx
- DeviceActivator
- CameraWidget
- compilerOptions
- VADCppProcess
- src/detect.rs
- Ext4InodeRef
- format.rs
- App.tsx
- useSettings.ts
- autoconfig.rs
- FlashState
- stt.c
- ChatBridge
- models.rs
- ext4_defs/extents.rs
- devices/windows.rs
- RuntimeError
- get_logger
- tts_api/main.py
- Block
- Ext4
- settings/index.ts
- AppState
- OpenMeteoSource
- StorageSection.tsx
- flash_image
- GuiDisplayModel
- ActivationModel
- operations.rs
- settings.rs
- Ext4Extent
- .set_attr
- sync-locales.js
- WebRTCAudioProcessing
- bindings.rs
- BinaryManager
- common_utils.py
- prelude.rs
- commands/system.rs
- macos/writer.rs
- AIServicesWidget
- WriteConfError
- Ext4
- ext4_crc32c
- scripts
- map_images
- macOS
- ._configure_environment
- BaseWindow
- captive-portal/app.js
- .read
- ArmbianBoardModal.tsx
- permissions
- get_block_devices
- images/mod.rs
- install.py
- TestWindowedLayoutAndCLI
- FileAttr
- Result
- get_boards
- js/app.js
- CLIActivation
- test_api.py
- WakeWordListener
- Ext4Error
- boards.rs
- ProgressTracker
- ._get_emotion_asset_path
- Ext4
- package.json
- flash_qdl_image
- flash_image
- verify.rs
- BaseDisplay
- CollectorScheduler
- ext4_defs/inode.rs
- Ext4
- Ext4
- tauri.conf.json
- bundle
- agent.py
- Ext4MountPoint
- app
- updater
- .fuse_read
- setup/install.sh
- STTController
- .new
- PartDev
- Ext4
- useToasts.tsx
- get_github_release
- config/mod.rs
- icon
- DependencyManager
- CaptivePortalHandler
- forge-agent.py
- install-linux.sh
- install-macos.sh
- get_qdl_devices
- windows
- mina_wakeword_daemon.py
- ._dispatch_callback
- .configVersion
- temp_copy
- forge_display.py
- SafeSession
- QdlStorage
- path_check
- build.rs
- request_authorization
- apicomm.c
- gui_display.py
- .sync_inode_to_disk
- tsconfig.json
- update_languages.py
- test_mic_level.py
- test_sherpa.py
- test_wakeword.py
- forge-write-conf
- install_linux.sh
- shared/__init__.py
- install.sh script
- machine-state.sh
- start_tts.sh
- startxorg.sh
- setup.sh script
- academic-assistant
- edge_opi_client
- Config

## God Nodes (most connected - your core abstractions)
1. `Ext4Inode` - 83 edges
2. `ConfigManager` - 50 edges
3. `GuiDisplay` - 49 edges
4. `EventRepository` - 46 edges
5. `Ext4Superblock` - 44 edges
6. `Ext4InodeRef` - 43 edges
7. `Ext4` - 40 edges
8. `ActivationWindow` - 35 edges
9. `get_logger()` - 35 edges
10. `FlashState` - 32 edges

## Surprising Connections (you probably didn't know these)
- `cleanup_legacy_cache()` --calls--> `assets_dir()`  [INFERRED]
  ForgeImager/src-tauri/src/images/mod.rs → ForgeImager/src-tauri/src/utils/system.rs
- `AcademicAgent` --uses--> `EventRepository`  [INFERRED]
  ForgeModules/sub-modulos/web-scraping/agent/chain.py → ForgeModules/sub-modulos/web-scraping/database/repository.py
- `get_agent()` --uses--> `AcademicAgent`  [INFERRED]
  ForgeModules/sub-modulos/web-scraping/api/dependencies.py → ForgeModules/sub-modulos/web-scraping/agent/chain.py
- `lifespan()` --uses--> `AcademicAgent`  [INFERRED]
  ForgeModules/sub-modulos/web-scraping/api/main.py → ForgeModules/sub-modulos/web-scraping/agent/chain.py
- `perguntar()` --uses--> `AcademicAgent`  [INFERRED]
  ForgeModules/sub-modulos/web-scraping/api/routes/agent.py → ForgeModules/sub-modulos/web-scraping/agent/chain.py

## Import Cycles
- None detected.

## Communities (200 total, 31 thin omitted)

### Community 0 - "utils/index.ts"
Cohesion: 0.10
Nodes (46): OsPanel(), formatBuildDate(), handleClick(), isCached(), renderOsCard(), renderRecommended(), renderRest(), statusOf() (+38 more)

### Community 2 - "cache.rs"
Cohesion: 0.10
Nodes (48): App, CacheBreakdown, CachedImageInfo, CacheEntry, calculate_cache_breakdown(), calculate_cache_size(), calculate_cache_size_internal(), clear_cache() (+40 more)

### Community 3 - "Path"
Cohesion: 0.09
Nodes (24): find_assets_dir(), find_assets_subpath(), find_config_dir(), find_directory(), find_file(), find_libs_dir(), find_models_dir(), find_models_subdir() (+16 more)

### Community 4 - "academic_db.py"
Cohesion: 0.08
Nodes (38): carregar_classificador_svm(), executar_query_com_intencao_mina(), extrair_embedding_matchboxnet(), gravar_audio_usuario(), Mapeia o ID da intenção predito para uma consulta real no banco da MINA., Usa o modelo Teacher (NVIDIA NeMo MatchboxNet) para extrair os embeddings do…, rodar_pipeline_mabi_mina(), main() (+30 more)

### Community 5 - "AcademicDataSource"
Cohesion: 0.07
Nodes (27): BoundLogger, Decimal, AcademicDataSource, CollectedEvent, ABC, Interface abstrata para fontes de dados acadêmicos. Preparada para substituição…, Evento acadêmico normalizado coletado de qualquer fonte., Contrato para implementações de coleta. (+19 more)

### Community 6 - "DownloadState"
Cohesion: 0.12
Nodes (39): decompress_local_file(), decompress_with_bz2(), decompress_with_gz(), decompress_with_reader_mt(), decompress_with_rust_xz(), decompress_with_zstd(), needs_decompression(), Arc (+31 more)

### Community 7 - "useTauri.ts"
Cohesion: 0.10
Nodes (43): LogsModal(), LogsModalProps, ChangelogModal(), ChangelogModalProps, handleOpenUrl(), handleUploadLogs(), useDeviceMonitor(), buildPhases() (+35 more)

### Community 8 - "logging/mod.rs"
Cohesion: 0.09
Nodes (33): cleanup_old_logs(), debug(), error(), get_current_log_path(), get_log_dir(), info(), init(), Logger (+25 more)

### Community 9 - "CacheService"
Cohesion: 0.08
Nodes (30): get_agent(), get_cache(), get_db_session(), AsyncSession, Dependências compartilhadas da API., get_dados_atuais(), get_historico(), get_ultimas_atualizacoes() (+22 more)

### Community 10 - "Settings"
Cohesion: 0.08
Nodes (26): BaseSettings, Document, AcademicAgent, metric_display_name(), Any, AsyncSession, Cadeia LangChain para perguntas acadêmicas., Agente com RAG e suporte a Ollama, OpenAI ou modo mock. (+18 more)

### Community 11 - "ResolvedQdl"
Cohesion: 0.09
Nodes (35): Duration, Fn, ensure_loader(), family_for_soc(), Option, PathBuf, Result, String (+27 more)

### Community 12 - "types/index.ts"
Cohesion: 0.07
Nodes (44): FlashProgressProps, BoardPanelProps, DevicePanelProps, Header(), HeaderProps, deviceStepMeta(), HomePage(), HomePageProps (+36 more)

### Community 13 - "Ext4"
Cohesion: 0.10
Nodes (18): BlockGroupCache, BlockGroupCacheManager, Ext4, Ext4Fsblk, Option, Result, Self, Vec (+10 more)

### Community 14 - "Ext4Superblock"
Cohesion: 0.07
Nodes (5): Ext4BlockGroup, Arc, BlockDevice, Self, Ext4Superblock

### Community 15 - "custom_image.rs"
Cohesion: 0.12
Nodes (39): both_required_files_present_is_qdl(), build_tar(), check_needs_decompression(), check_tar_for_qdl(), classify_custom_image(), CustomImageClassification, CustomImageInfo, decompress_custom_image() (+31 more)

### Community 16 - "webrtc_apm/__init__.py"
Cohesion: 0.10
Nodes (21): AdaptiveDigital, AnalogGainController, AnalogMicGainEmulation, CaptureLevelAdjustment, ClippingPredictor, ClippingPredictorMode, DownmixMethod, EchoCanceller (+13 more)

### Community 17 - "EventRepository"
Cohesion: 0.09
Nodes (19): create_db_tools(), Any, AsyncSession, Ferramentas LangChain para consulta ao banco., Cria ferramentas vinculadas à sessão do banco., DataSource, EventMetric, EventUpdate (+11 more)

### Community 18 - "STTClient"
Cohesion: 0.09
Nodes (24): _check_gui_launch_args(), cli_loop(), main(), main(), _parse_cli_args(), Run the GUI display in standalone mode., Main entry point for the GUI-only launcher., run_gui() (+16 more)

### Community 19 - "GuiDisplay"
Cohesion: 0.06
Nodes (17): GuiDisplay, QObject, Atualiza texto de status., Atualiza texto do botão., Atualiza visibilidade da barra de botões., Alterna visibilidade da janela., Classe de display GUI - interface moderna baseada em QML., Clique no botão enviar texto. (+9 more)

### Community 20 - "LayoutConfigModel"
Cohesion: 0.09
Nodes (20): _build_light_theme(), _deep_merge(), LayoutConfigModel, Any, QObject, Return *base* with values from *override* applied on top., Exposes layout configuration to QML and supports runtime editing., Load layout_config.json, falling back to built-in defaults. (+12 more)

### Community 21 - "AutoconfigSection.tsx"
Cohesion: 0.09
Nodes (25): AutoconfigSection(), AutoconfigSectionProps, countSet(), IconType, SegmentedProps, SelectInputProps, TextInputProps, ToggleRowProps (+17 more)

### Community 22 - "config/index.ts"
Cohesion: 0.09
Nodes (34): BoardBadgesProps, ErrorDisplayProps, MotdMessage, BadgeConfig, DESKTOP_BADGES, DESKTOP_ENVIRONMENTS, KERNEL_BADGES, CACHE (+26 more)

### Community 23 - "api/main.py"
Cohesion: 0.14
Nodes (22): DeclarativeBase, FastAPI, create_app(), lifespan(), Aplicação FastAPI principal., main(), Ponto de entrada do serviço coletor., get_settings() (+14 more)

### Community 24 - "Ext4DirEntry"
Cohesion: 0.08
Nodes (11): Ext4DirEnInternal, Ext4DirEntry, Ext4DirEntryTail, Debug, Default, DirEntryType, Formatter, Result (+3 more)

### Community 25 - "ActivationWindow"
Cohesion: 0.09
Nodes (3): open_url(), ActivationWindow, Any

### Community 26 - "AppearanceSection.tsx"
Cohesion: 0.11
Nodes (25): App(), AppearanceSection(), THEME_OPTIONS, ThemeOption, AUTO_LANGUAGE, FLAG_URLS, flagUrl(), getDefaultLanguage() (+17 more)

### Community 27 - "ConfigManager"
Cohesion: 0.10
Nodes (17): ConfigManager, Any, Configuration manager - singleton., Ensure singleton mode., Initialize the configuration manager., Initialize config file paths., Ensure required directories exist., Load config file, creating it if missing. (+9 more)

### Community 28 - "TTSClient"
Cohesion: 0.09
Nodes (14): TTS Client — Direct local edge-tts integration inside the application.…, Discover the MinaTTS FastAPI service dynamically using Zeroconf., Fire-and-forget synthesis — returns a Task that resolves to bytes., Synthesize MP3 bytes using remote server if available, falling back to local…, Play MP3 bytes through the persistent output device (0ms latency, no cutoff)., Direct, embedded wrapper around the local edge-tts engine with persistent…, Verify the edge-tts local module functions properly., TTSClient (+6 more)

### Community 29 - "AudioWidget"
Cohesion: 0.12
Nodes (4): AudioWidget, QWidget, 自动选择默认设备（与audio_codec.py的逻辑保持一致）。, 后台线程安全地将状态文本追加到 QTextEdit（通过信号切回主线程）。

### Community 30 - "dependencies"
Cohesion: 0.07
Nodes (29): ansi-to-html, dependencies, ansi-to-html, i18next, lucide-react, qrcode, react, react-dom (+21 more)

### Community 31 - "devDependencies"
Cohesion: 0.07
Nodes (29): eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks (+21 more)

### Community 32 - "Ext4ExtentHeader"
Cohesion: 0.10
Nodes (3): Ext4ExtentHeader, Ext4ExtentIndex, Self

### Community 33 - "ManufacturerPanel.tsx"
Cohesion: 0.14
Nodes (23): BoardPanel(), ManufacturerPanel(), ErrorDisplay(), SearchBox(), SearchBoxProps, UI, AsyncDataResult, useAsyncData() (+15 more)

### Community 34 - "UpdateModal.tsx"
Cohesion: 0.26
Nodes (9): UpdateEntry(), DownloadProgress, UpdateModal(), UpdateState, UpdateContext, UpdateContextType, useUpdate(), isAppInApplications() (+1 more)

### Community 35 - "SettingsWindow"
Cohesion: 0.11
Nodes (5): QWidget, ShortcutsSettingsWidget, Return True if user edited wake words since last load/save., Apply a cohesive visual theme without changing the dialog layout., SettingsWindow

### Community 36 - "picture_cache.rs"
Cohesion: 0.18
Nodes (25): get_cached_board_image(), get_cached_vendor_logo(), Option, Result, String, AssetEntry, AssetsMeta, download_asset() (+17 more)

### Community 37 - "flash.rs"
Cohesion: 0.25
Nodes (25): build_ufs_packet(), check_cancelled(), connect_and_configure(), find_rootfs_image(), inject_autoconfig(), patch_from_xml(), program_from_xml(), program_single_partition() (+17 more)

### Community 38 - "FlashProgress.tsx"
Cohesion: 0.19
Nodes (18): getOsName(), FlashActions(), FlashActionsProps, activeIndex(), FlashPhaseDots(), FlashProgress(), getImageDisplayText(), FlashPhase (+10 more)

### Community 39 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+18 more)

### Community 40 - "WakeWordWidget"
Cohesion: 0.11
Nodes (8): Browse Porcupine .pv model file., Browse Porcupine .ppn keyword file., 将绝对路径转换为相对于项目根目录的相对路径（如果在同一盘符）., 从 keywords.txt 文件加载唤醒词，只显示中文部分., 将拼音按声母韵母分隔. 例如: "xiǎo" -> ["x", "iǎo"] "mǐ" -> ["m", "ǐ"], 将中文转换为keyword格式. Args: chinese_text: 中文文本，如"小米小米" Returns: keyword格式，如"x iǎo m…, 保存唤醒词到 keywords.txt 文件，自动将中文转换为拼音格式., WakeWordWidget

### Community 41 - "BaseSettingsWidget"
Cohesion: 0.11
Nodes (8): BaseSettingsWidget, QWidget, Set text of a widget control., Set checked state of a checkbox or radio button., Set value of a spinbox or slider., Base class for settings widgets, providing common UI setter/getter helpers., Get value of a spinbox or slider., SystemOptionsWidget

### Community 42 - "macos.rs"
Cohesion: 0.20
Nodes (22): CFDictionary, CFString, CFStringRef, CFType, DADiskRef, check_sd_icon(), DADisk, DASession (+14 more)

### Community 43 - "Ext4"
Cohesion: 0.24
Nodes (6): ExtentPathNode, Default, SearchPath, Ext4, Ext4Lblk, Result

### Community 44 - "DevicePanel.tsx"
Cohesion: 0.11
Nodes (20): AUTOCONFIG_PROFILE_SELECTED_EVENT, DevicePanel(), BoardImage(), BoardImageProps, ConfirmationDialog(), ConfirmationDialogProps, DeviceIcon(), getDeviceBadge() (+12 more)

### Community 45 - "DeviceActivator"
Cohesion: 0.11
Nodes (12): DeviceActivator, Device activation manager - fully async., Run activation flow asynchronously. Args: challenge: Challenge string from the…, Initialize the device activator., Ensure device identity exists., Cancel the activation flow., Check whether a serial number exists., Get the serial number. (+4 more)

### Community 47 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+14 more)

### Community 48 - "VADCppProcess"
Cohesion: 0.14
Nodes (6): Any, Path, Run the vad_cpp binary and translate its output into `on_timeout` calls., VADCppProcess, Simple VAD monitor using a Silero ONNX model and a PortAudio input stream., VADMonitor

### Community 49 - "src/detect.rs"
Cohesion: 0.22
Nodes (19): detect_rootfs(), detect_scheme(), detects_gpt_rootfs_4096(), detects_gpt_rootfs_512(), locate_gpt_rootfs(), locate_mbr_rootfs(), make_gpt_image(), probe_gpt_sector_size() (+11 more)

### Community 50 - "Ext4InodeRef"
Cohesion: 0.23
Nodes (6): Ext4InodeRef, Ext4, Ext4Fsblk, Ext4Lblk, Result, Vec

### Community 51 - "format.rs"
Cohesion: 0.14
Nodes (12): ext4_extent_tail_offset(), ForgeFilenameInfo, format_size(), normalize_slug(), parse_forge_filename(), Option, String, strip_image_extensions() (+4 more)

### Community 52 - "App.tsx"
Cohesion: 0.14
Nodes (20): AppContent(), handleBoardSelect(), handleComplete(), handleCustomImage(), handleImageSelect(), handleManufacturerSelect(), handleNavigateToStep(), handleReset() (+12 more)

### Community 53 - "useSettings.ts"
Cohesion: 0.31
Nodes (19): PreferencesSection(), MotdTip(), getAllowSystemDevices(), getForceOffline(), getForgeBoardDetection(), getShowMotd(), getShowUpdaterModal(), getShowWelcome() (+11 more)

### Community 54 - "autoconfig.rs"
Cohesion: 0.23
Nodes (18): AutoconfigConfig, empty(), empty_string_is_skipped(), inject_into_bare_ext4_image(), inject_into_image(), lang_flag_uses_y_n(), network_keys_gated_on_apply_network(), push_bool() (+10 more)

### Community 55 - "FlashState"
Cohesion: 0.19
Nodes (16): FlashState, fsync_checked(), QdlProgress, request_authorization(), AtomicBool, AtomicU64, Display, Mutex (+8 more)

### Community 56 - "stt.c"
Cohesion: 0.16
Nodes (17): audio_callback(), cleanup_stream(), create_temp_wav_path(), ensure_initialized(), extract_text_field(), response_write(), sb_append(), sb_free() (+9 more)

### Community 57 - "ChatBridge"
Cohesion: 0.10
Nodes (19): ChatBridge, Runs the apicomm C binary or Groq chat stream to callbacks., get_all_memories(), get_setting(), init_db(), Retrieve a setting value by key., Initialize the SQLite memories database., Save a new memory keypoint, updating it if it already exists, or deleting if… (+11 more)

### Community 58 - "models.rs"
Cohesion: 0.24
Nodes (19): CompanionInfo, DisplayVariantInfo, ApiBoardSummary, ApiCompanion, ApiDisplayVariant, ApiDownloadInfo, ApiImage, ApiMeta (+11 more)

### Community 59 - "ext4_defs/extents.rs"
Cohesion: 0.19
Nodes (12): Ext4ExtentTail, ExtentNode, NodeData, Ext4Lblk, Option, Result, Vec, test_binsearch_extent() (+4 more)

### Community 60 - "devices/windows.rs"
Cohesion: 0.22
Nodes (19): bus_type_to_string(), DeviceMediaInfo, DiskGeometry, DiskGeometryEx, extract_ascii_string(), get_block_devices(), get_drive_letters_for_disk(), GetMediaTypes (+11 more)

### Community 61 - "RuntimeError"
Cohesion: 0.70
Nodes (4): _ensure_library_loaded(), _get_library_path(), _init_function_signatures(), RuntimeError

### Community 62 - "get_logger"
Cohesion: 0.15
Nodes (5): get_logger(), Get a logger with the shared configuration. Args: name: Logger name, usually…, AsyncMixin, AsyncSignalEmitter, QObject

### Community 63 - "tts_api/main.py"
Cohesion: 0.16
Nodes (19): _cache_key(), get_local_ip(), health(), list_voices(), _normalize_text(), BaseModel, get, post (+11 more)

### Community 64 - "Block"
Cohesion: 0.15
Nodes (9): Block, BlockDevice, Any, Arc, Self, Send, Sync, Vec (+1 more)

### Community 66 - "settings/index.ts"
Cohesion: 0.15
Nodes (16): AboutSection(), formatPlatformName(), InfoCardProps, LinkButtonProps, DeveloperSection(), SettingsButton(), SettingsButtonProps, NAV_ITEMS (+8 more)

### Community 67 - "AppState"
Cohesion: 0.20
Nodes (16): cancel_operation(), DownloadProgress, FlashProgress, get_download_progress(), get_flash_progress(), Option, Result, State (+8 more)

### Community 68 - "OpenMeteoSource"
Cohesion: 0.15
Nodes (11): OpenMeteoSource, ClientSession, datetime, Fonte via API pública Open-Meteo., asyncio, fixture, Testes do coletor Open-Meteo., source() (+3 more)

### Community 69 - "StorageSection.tsx"
Cohesion: 0.27
Nodes (11): StorageSection(), getCacheEnabled(), getCacheMaxSize(), setCacheEnabled(), setCacheMaxSize(), SettingsLoader, useSettingsGroup(), clearCache() (+3 more)

### Community 70 - "flash_image"
Cohesion: 0.31
Nodes (17): extract_disk_number(), flash_image(), flush_device_buffers(), get_device_sector_size(), lock_disk_volumes(), open_device_for_read(), open_device_for_write(), Arc (+9 more)

### Community 71 - "GuiDisplayModel"
Cohesion: 0.18
Nodes (5): GuiDisplayModel, pyqtProperty, QObject, setter, GUI 主窗口的数据模型，用于 Python 和 QML 之间的数据绑定.

### Community 72 - "ActivationModel"
Cohesion: 0.19
Nodes (5): ActivationModel, pyqtProperty, QObject, setter, 激活窗口的数据模型，用于Python和QML之间的数据绑定.

### Community 73 - "operations.rs"
Cohesion: 0.29
Nodes (16): AppHandle, cleanup_failed_download(), continue_download_without_sha(), delete_downloaded_image(), download_image(), flash_image(), force_delete_cached_image(), prepare_autoconfig_copy() (+8 more)

### Community 74 - "settings.rs"
Cohesion: 0.24
Nodes (16): CacheBreakdown, CachedImageInfo, clear_cache(), delete_cached_image(), get_cache_breakdown(), get_cache_size(), get_logs(), get_system_info() (+8 more)

### Community 76 - ".set_attr"
Cohesion: 0.12
Nodes (3): InodeFileType, InodePerm, test_set_file_type_and_perm()

### Community 77 - "sync-locales.js"
Cohesion: 0.13
Nodes (11): __dirname, LANGUAGE_NAMES, localeFiles, localesDir, preservePlaceholders(), sourceContent, sourceData, sourceFile (+3 more)

### Community 78 - "WebRTCAudioProcessing"
Cohesion: 0.17
Nodes (7): Array, WebRTC 音频处理的高级 Python 封装器。, 创建流配置。 Args: sample_rate: 采样率（Hz）（例如：16000, 48000） num_channels:…, 处理反向流（渲染/播放音频）。 Args: src: 源音频缓冲区 src_config: 源流配置句柄 dest_config: 目标流配置句柄 dest:…, 处理采集流（麦克风音频）。 Args: src: 源音频缓冲区 src_config: 源流配置句柄 dest_config: 目标流配置句柄 dest:…, 设置流延迟（毫秒）。 Args: delay_ms: 延迟（毫秒）, WebRTCAudioProcessing

### Community 79 - "bindings.rs"
Cohesion: 0.17
Nodes (15): free_authorization(), request_authorization(), AuthorizationRef, Result, String, SavedAuthorization, AuthorizationEnvironment, AuthorizationExternalForm (+7 more)

### Community 80 - "BinaryManager"
Cohesion: 0.19
Nodes (9): BinaryManager, Path, Ensures the STT shared library is compiled and returns its path., Manages architecture-specific native binaries and their compilation., Ensure arch-specific directories exist., Returns the expected path for a binary executable., Returns the expected path for a shared library., Runs the Makefile for a specific target. (+1 more)

### Community 81 - "common_utils.py"
Cohesion: 0.20
Nodes (15): _audio_queue_worker(), copy_to_clipboard(), _ensure_audio_worker(), extract_verification_code(), handle_verification_code(), play_audio_nonblocking(), _play_linux_tts(), _play_macos_tts() (+7 more)

### Community 83 - "commands/system.rs"
Cohesion: 0.28
Nodes (14): ForgeReleaseInfo, get_forge_release(), get_system_locale(), get_username_from_uid(), log_debug_from_frontend(), log_from_frontend(), log_warn_from_frontend(), open_url() (+6 more)

### Community 84 - "macos/writer.rs"
Cohesion: 0.35
Nodes (14): do_flash_work(), flash_image(), open_device_with_saved_auth(), OpenDeviceResult, quick_erase(), Arc, AuthorizationRef, File (+6 more)

### Community 85 - "AIServicesWidget"
Cohesion: 0.24
Nodes (4): AIServicesWidget, QWidget, Widget for configuring LLM, STT, and TTS services., test_gui_widgets()

### Community 86 - "WriteConfError"
Cohesion: 0.23
Nodes (12): Display, Error, Formatter, From, Path, Result, Self, String (+4 more)

### Community 87 - "Ext4"
Cohesion: 0.27
Nodes (5): Ext4DirSearchResult, Ext4, DirEntryType, Result, Vec

### Community 88 - "ext4_crc32c"
Cohesion: 0.15
Nodes (4): Arc, BlockDevice, crc32(), ext4_crc32c()

### Community 89 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, build:dev, build:prod, clean, --dev, lint, --other (+7 more)

### Community 90 - "map_images"
Cohesion: 0.15
Nodes (12): is_flashable_format(), map_board(), map_image(), map_images(), BoardInfo, ImageInfo, Vec, qdl_storage_supported() (+4 more)

### Community 91 - "macOS"
Cohesion: 0.13
Nodes (15): x, y, x, y, macOS, applicationFolderPosition, appPosition, background (+7 more)

### Community 92 - "._configure_environment"
Cohesion: 0.13
Nodes (7): Configura o ambiente., Cria a janela principal., Calcula tamanho da janela a partir da configuração. Retorna ((w, h),…, Configura interações (sinais)., Conecta sinais QML aos slots Python., Configura handler de sinais (Ctrl+C)., Handler de ativação do app (clique no Dock do macOS restaura janela).

### Community 93 - "BaseWindow"
Cohesion: 0.18
Nodes (3): BaseWindow, QWidget, QMainWindow

### Community 94 - "captive-portal/app.js"
Cohesion: 0.18
Nodes (10): API_BASE_URLS, executeProvision(), nextStep(), prevStep(), renderScanResults(), scanWifiNetworks(), selectWifiRow(), state (+2 more)

### Community 95 - ".read"
Cohesion: 0.22
Nodes (12): Ext4Read, Ext4Ro, PartReader, Box, Error, File, Path, Result (+4 more)

### Community 96 - "ArmbianBoardModal.tsx"
Cohesion: 0.23
Nodes (9): ForgeBoardModal(), ForgeBoardModalProps, Modal(), ModalProps, BoardBadges(), useModalExitAnimation(), UseModalExitAnimationOptions, UseModalExitAnimationReturn (+1 more)

### Community 97 - "permissions"
Cohesion: 0.14
Nodes (13): description, identifier, permissions, $schema, windows, core:default, core:window:allow-start-dragging, dialog:default (+5 more)

### Community 98 - "get_block_devices"
Cohesion: 0.24
Nodes (12): get_block_devices(), get_system_disks(), is_device_read_only(), BlockDevice, Result, String, Vec, BlockDevice (+4 more)

### Community 99 - "images/mod.rs"
Cohesion: 0.27
Nodes (13): cleanup_legacy_cache(), fetch_board_qdl(), fetch_boards(), fetch_images_for_board(), fetch_vendors(), get_cache_path(), load_cache(), Option (+5 more)

### Community 100 - "install.py"
Cohesion: 0.49
Nodes (13): build_c_components(), check_and_clone_repo(), get_architecture(), install_python_requirements(), install_system_dependencies(), log_err(), log_step(), log_success() (+5 more)

### Community 101 - "TestWindowedLayoutAndCLI"
Cohesion: 0.14
Nodes (7): Test R3: Rotation angle dimension swapping logic., Test that window size clamping happens AFTER rotation dimension swapping., Test R1: GuiDisplay constants DEFAULT_WINDOW_SIZE and MINIMUM_WINDOW_SIZE., Test R1: Offset noise in config/layout_config.json is zeroed out., Test R2: main_gui._parse_cli_args with -w, --windowed, --gui, -f, -F, -g…, Test R2: main_cli._check_gui_launch_args detects windowed/gui/gravity flags., TestWindowedLayoutAndCLI

### Community 102 - "FileAttr"
Cohesion: 0.17
Nodes (6): FileAttr, LinuxStat, Default, InodeFileType, InodePerm, Self

### Community 104 - "get_boards"
Cohesion: 0.29
Nodes (12): get_block_devices(), get_boards(), get_images_for_board(), get_vendors(), BlockDevice, BoardInfo, ImageInfo, Option (+4 more)

### Community 105 - "js/app.js"
Cohesion: 0.27
Nodes (11): addMessage(), charts, fetchJSON(), formatDate(), formatTime(), handleChatSubmit(), refreshDashboard(), setConnectionStatus() (+3 more)

### Community 106 - "CLIActivation"
Cohesion: 0.27
Nodes (3): CLIActivation, Any, 运行完整的CLI激活流程. Returns: bool: 激活是否成功

### Community 107 - "test_api.py"
Cohesion: 0.45
Nodes (11): AsyncClient, client(), main(), print_sep(), test_api.py — Testes de latência e qualidade da TTS API local Executa contra…, test_cache_efficiency(), test_get_endpoint(), test_health() (+3 more)

### Community 108 - "WakeWordListener"
Cohesion: 0.23
Nodes (4): Exception, Path, Background wake-word listener powered by Picovoice Porcupine., WakeWordListener

### Community 109 - "Ext4Error"
Cohesion: 0.33
Nodes (7): Errno, Ext4Error, From, Option, Self, FromUtf8Error, Utf8Error

### Community 110 - "boards.rs"
Cohesion: 0.24
Nodes (6): find(), finds_board_by_slug_substring(), QdlBoard, Option, String, ufs_board_slug_for_filename()

### Community 111 - "ProgressTracker"
Cohesion: 0.23
Nodes (8): bytes_to_mb(), ProgressSummary, ProgressTracker, ProgressUpdate, Option, Self, String, Instant

### Community 112 - "._get_emotion_asset_path"
Cohesion: 0.17
Nodes (6): Path, Atualiza emoção exibida., Carrega interface QML., Obtém caminho do asset de emoção, com fallback de extensão., Busca arquivo de emoção no diretório especificado., Eagerly preload all emotion assets into the cache at startup. This avoids file-…

### Community 113 - "Ext4"
Cohesion: 0.25
Nodes (6): Ext4, Arc, BlockDevice, Result, Self, Vec

### Community 114 - "package.json"
Cohesion: 0.18
Nodes (10): author, description, engines, node, maintainers, name, private, type (+2 more)

### Community 115 - "flash_qdl_image"
Cohesion: 0.35
Nodes (10): flash_qdl_image(), flash_qdl_ufs_image(), get_qdl_devices(), AutoconfigConfig, Option, QdlDevice, Result, State (+2 more)

### Community 116 - "flash_image"
Cohesion: 0.55
Nodes (10): flash_image(), open_device_direct(), open_device_udisks2(), quick_erase(), Arc, File, PathBuf, Result (+2 more)

### Community 117 - "verify.rs"
Cohesion: 0.24
Nodes (9): Arc, PathBuf, R, Read, Result, Send, String, VerificationReader (+1 more)

### Community 119 - "CollectorScheduler"
Cohesion: 0.24
Nodes (5): async_sessionmaker, CollectorScheduler, AsyncSession, Executa coleta periódica com tratamento de falhas., Executa uma coleta imediata. Retorna True se bem-sucedida.

### Community 122 - "Ext4"
Cohesion: 0.36
Nodes (3): Ext4, Result, Vec

### Community 123 - "tauri.conf.json"
Cohesion: 0.20
Nodes (9): build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist, identifier, productName, $schema (+1 more)

### Community 124 - "bundle"
Cohesion: 0.20
Nodes (10): bundleMediaFramework, bundle, active, category, createUpdaterArtifacts, linux, longDescription, shortDescription (+2 more)

### Community 125 - "agent.py"
Cohesion: 0.24
Nodes (9): perguntar(), PerguntaRequest, PerguntaResponse, Any, AsyncSession, BaseModel, post, Rotas do agente de IA. (+1 more)

### Community 126 - "Ext4MountPoint"
Cohesion: 0.22
Nodes (6): Ext4MountPoint, Debug, Formatter, Result, Self, String

### Community 127 - "app"
Cohesion: 0.22
Nodes (9): app, macOSPrivateApi, security, windows, enable, scope, assetProtocol, csp (+1 more)

### Community 128 - "updater"
Cohesion: 0.22
Nodes (9): plugins, shell, updater, open, endpoints, pubkey, windows, installMode (+1 more)

### Community 130 - "setup/install.sh"
Cohesion: 0.46
Nodes (6): detect_os(), print_error(), print_header(), print_info(), print_warning(), install.sh script

### Community 132 - ".new"
Cohesion: 0.33
Nodes (6): F, ProgressReader, ProgressReader<R, F>, R, Read, Self

### Community 133 - "PartDev"
Cohesion: 0.29
Nodes (5): PartDev, BlockDevice, File, Mutex, Vec

### Community 134 - "Ext4"
Cohesion: 0.33
Nodes (6): Ext4, Arc, BlockDevice, Option, Vec, SystemZone

### Community 135 - "useToasts.tsx"
Cohesion: 0.29
Nodes (6): Toast(), ToastProps, ToastContext, ToastContextValue, ToastItem, ToastProvider()

### Community 136 - "get_github_release"
Cohesion: 0.48
Nodes (6): get_github_release(), GitHubRelease, is_app_in_applications(), Option, Result, String

### Community 137 - "config/mod.rs"
Cohesion: 0.48
Nodes (6): api_base(), health(), latest_release(), qdl_blob_base(), releases(), String

### Community 138 - "icon"
Cohesion: 0.29
Nodes (7): icon, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, icons/icon.ico, icons/icon.png

### Community 139 - "DependencyManager"
Cohesion: 0.33
Nodes (4): DependencyManager, Checks if apt-get is available on the system., Parses a compilation error message for missing headers and attempts to install…, Handles automatic detection and installation of system dependencies.

### Community 140 - "CaptivePortalHandler"
Cohesion: 0.33
Nodes (3): CaptivePortalHandler, main(), ReusableTCPServer

### Community 141 - "forge-agent.py"
Cohesion: 0.67
Nodes (6): apply_provisioning(), get_hdmi_status(), kill_stale_port_processes(), run_cmd_safe(), setup_wifi_hardware(), start_captive_portal()

### Community 142 - "install-linux.sh"
Cohesion: 0.60
Nodes (5): print_error(), print_info(), print_success(), print_warning(), install-linux.sh script

### Community 143 - "install-macos.sh"
Cohesion: 0.60
Nodes (5): print_error(), print_info(), print_success(), print_warning(), install-macos.sh script

### Community 144 - "get_qdl_devices"
Cohesion: 0.33
Nodes (5): get_qdl_devices(), QdlDevice, Result, String, Vec

### Community 145 - "windows"
Cohesion: 0.33
Nodes (6): windows, installerIcon, certificateThumbprint, digestAlgorithm, nsis, timestampUrl

### Community 146 - "mina_wakeword_daemon.py"
Cohesion: 0.47
Nodes (5): find_input_device(), main(), Context manager to suppress low-level C++ stderr logging (like ONNX schema…, Find the best input audio device index, prioritizing PulseAudio on Linux., suppress_stderr()

### Community 147 - "._dispatch_callback"
Cohesion: 0.33
Nodes (3): Clique no botão auto., Clique no botão abortar., Dispatcher genérico de callbacks.

### Community 148 - ".configVersion"
Cohesion: 0.40
Nodes (3): pyqtProperty, setter, Incremented on every layout change so QML can observe updates.

### Community 149 - "temp_copy"
Cohesion: 0.60
Nodes (4): inject_into_real_image(), Path, PathBuf, temp_copy()

### Community 151 - "forge_display.py"
Cohesion: 0.70
Nodes (4): generate_display_image(), get_fb_resolution(), get_ttf_font(), render_to_framebuffer()

### Community 152 - "SafeSession"
Cohesion: 0.50
Nodes (3): DASessionRef, Drop, SafeSession

### Community 156 - "request_authorization"
Cohesion: 0.50
Nodes (3): request_authorization(), Result, String

### Community 165 - "forge-write-conf"
Cohesion: 0.67
Nodes (3): forge-ext4fs, forge-imager, forge-write-conf

### Community 199 - "Config"
Cohesion: 0.50
Nodes (3): Config, create_default_config(), 将配置应用到音频处理模块。 Args: config: 配置结构体 Returns: 状态码（0表示成功）

## Knowledge Gaps
- **264 isolated node(s):** `RestFilter`, `CacheManagerModalProps`, `Step`, `StepState`, `WelcomePageProps` (+259 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `WebRTCAudioProcessing` connect `WebRTCAudioProcessing` to `webrtc_apm/__init__.py`, `RuntimeError`, `Config`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **Why does `ConfigManager` connect `ConfigManager` to `SettingsWindow`, `academic_db.py`, `WakeWordWidget`, `BaseSettingsWidget`, `WakeWordListener`, `CameraWidget`, `VADCppProcess`, `STTClient`, `GuiDisplay`, `AIServicesWidget`, `ActivationWindow`, `get_logger`, `ChatBridge`, `AudioWidget`, `gui_display.py`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `GuiDisplay` connect `GuiDisplay` to `TestWindowedLayoutAndCLI`, `GuiDisplayModel`, `._get_emotion_asset_path`, `STTClient`, `._dispatch_callback`, `LayoutConfigModel`, `BaseDisplay`, `ConfigManager`, `._configure_environment`, `gui_display.py`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `ConfigManager` (e.g. with `GuiDisplay` and `sync_from_scraper()`) actually correct?**
  _`ConfigManager` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `GuiDisplay` (e.g. with `GuiDisplayModel` and `LayoutConfigModel`) actually correct?**
  _`GuiDisplay` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `EventRepository` (e.g. with `AcademicAgent` and `RAGRetriever`) actually correct?**
  _`EventRepository` has 13 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RestFilter`, `CacheManagerModalProps`, `Step` to the rest of the system?**
  _264 weakly-connected nodes found - possible documentation gaps or missing edges._