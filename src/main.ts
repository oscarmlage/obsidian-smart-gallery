import { Plugin, type WorkspaceLeaf, addIcon, Notice, TFile, TFolder, TAbstractFile, Platform, type Vault } from 'obsidian'
import { scaleColor, type ImageResources, addEmbededTags, getimageLink, getImageInfo, preprocessUri, ToastMessage, addRemoteMeta, isRemoteMedia, getTags, sleep } from './utils'
import { GallerySettingTab } from './settings'
import { GalleryBlock } from './Blocks/GalleryBlock'
import { ImageInfoBlock } from './Blocks/ImageInfoBlock'
import { GalleryView } from './DisplayObjects/GalleryView'
import { GalleryInfoView } from './DisplayObjects/GalleryInfoView'
import type { GallerySettings, PlatformSettings } from './TechnicalFiles/GallerySettings'
import { DEFAULT_SETTINGS, OB_GALLERY, OB_GALLERY_INFO, GALLERY_ICON, GALLERY_SEARCH_ICON, EXTENSIONS } from './TechnicalFiles/Constants'
import { loc } from './Loc/Localizer'
import { ProgressModal } from './Modals/ProgressPopup'
import { ImageMenu } from './Modals/ImageMenu'
import type en from './Loc/Languages/en'

export default class GalleryTagsPlugin extends Plugin
{
  settings!: GallerySettings;
  containerEl!: HTMLElement;
	accentColor: string;
	accentColorDark: string;
  accentColorLight: string;
  onResize: () => void;
  embedQueue: ImageResources = {};
  finalizedQueue: ImageResources = {};
  tagCache:string[] = [];
  propertyCache:Record<string,string[]> = {};
	imgResources: ImageResources = {}
	metaResources: ImageResources = {}
  #bootstrapped: boolean;


  async onload()
  {
    this.#bootstrapped = false;
    this.strapped = this.strapped.bind(this);
    // Load message
    await this.loadSettings();
    console.debug(loc("LOADED_PLUGIN_MESSAGE", loc('PLUGIN_NAME')));

    this.#registerCodeBlocks();

    // Add Gallery Icon
    addIcon('fa-Images', GALLERY_ICON)
    addIcon('fa-search', GALLERY_SEARCH_ICON)

    // Register Main Gallery View
    this.registerView(OB_GALLERY, this.galleryViewCreator.bind(this))
    this.registerView(OB_GALLERY_INFO, this.galleryInfoCreator.bind(this))

		// Add Main Gallery Ribbon
		this.addRibbonIcon('fa-Images', 'Gallery', () =>
		{
			this.showPanel()
		});

    this.addSettingTab(new GallerySettingTab(this.app, this))
    void this.saveSettings();

    this.app.workspace.onLayoutReady(this.#bootstrap.bind(this));

    // might use this later for integration tasks
    // this.manifest.dir
    // this.plugins.plugins.dataview.manifest.dir
  }

  platformSettings(): PlatformSettings
  {
    if(this.settings.uniqueMobileSettings && !Platform.isDesktopApp)
    {
      return this.settings.mobile;
    }

    return this.settings.desktop;
  }

  getTags() : string[]
  {
    if(this.tagCache === undefined)
    {
      this.bootstrapFailed('CAUSE_TAG_CACHE');
      return [];
    }
    return this.tagCache;
  }

  getFieldTags(field:string) : string[]
  {
    if(this.propertyCache === undefined)
    {
      this.bootstrapFailed('CAUSE_TAG_CACHE');
      return [];
    }
    return this.propertyCache[field];
  }

  getImgResources() : ImageResources
  {
    if(this.imgResources === undefined)
    {
      this.bootstrapFailed('CAUSE_IMAGE_RESOURCES');
      return {};
    }
    return this.imgResources;
  }

  getMetaResources() : ImageResources
  {
    if(this.metaResources === undefined)
    {
      this.bootstrapFailed('CAUSE_META_RESOURCES');
      return {};
    }
    return this.metaResources;
  }

  bootstrapFailed(cause:keyof typeof en)
  {
    ToastMessage(loc('BOOTSTRAP_FAILURE', loc(cause)), 25, ()=>{void this.#bootstrap()}, 'CONTEXT_RETRY');
  }

  async #bootstrap()
  {
    await this.buildCaches();
    this.#refreshColors();
    this.#registerEvents();

    this.#bootstrapped = true;
  }

  async buildCaches(): Promise<void>
  {
    this.buildTagCache();
    this.#buildImageCache();
    await this.#buildMetaCache();
  }

  // wait for thing to finish loading up
  async strapped(): Promise<boolean>
  {
    while(this.#bootstrapped !== true)
    {
      await sleep(300);
    }

    return Promise.resolve(true);
  }

  #registerCodeBlocks()
  {
    // Register gallery display block renderer
    this.registerMarkdownCodeBlockProcessor('gallery', async (source, el, ctx) =>
    {
      const proc = new GalleryBlock()
      await proc.galleryDisplay(source, el, this.app.vault, this)
    });

    // Register image info block
    this.registerMarkdownCodeBlockProcessor('gallery-info', async (source, el, ctx) =>
    {
      const proc = new ImageInfoBlock()
      await proc.galleryImageInfo(source, el, ctx.sourcePath, this)
    });
  }

  #registerEvents()
  {
    // Resize event
    this.registerEvent(
      this.app.workspace.on("resize", () => {
          try
          {
            if(this.onResize)
            {
              this.onResize()
            }
          }
          catch
          {
            this.onResize = null;
          }
      }));

    // Metadata changed event
    this.registerEvent(
      this.app.metadataCache.on("changed", (file, _data, cache) =>
      {
        // Used for reacting to meta file creation events in real time
        if(this.embedQueue[file.path])
        {
          if(isRemoteMedia(this.embedQueue[file.path]))
          {
            const path = this.embedQueue[file.path]
            this.finalizedQueue[file.path] = path;
            delete this.embedQueue[file.path];

            this.metaResources[path] = file.path;
            void addRemoteMeta(path, file, this);
          }
          else
          {
            const imgTFile = this.app.vault.getAbstractFileByPath(this.embedQueue[file.path]);

            if(imgTFile instanceof TFile)
            {
              this.finalizedQueue[file.path] = this.embedQueue[file.path];
              delete this.embedQueue[file.path];

              this.metaResources[imgTFile.path] = file.path;
              void addEmbededTags(imgTFile, file, this);
            }
          }
        }
        else if(this.finalizedQueue[file.path])
        {
          void GalleryInfoView.OpenLeaf(this, this.finalizedQueue[file.path]);
          delete this.finalizedQueue[file.path];
        }


        // try to catch and cache any new tags
        const newTags = getTags(cache);
        for(let k = 0; k < newTags.length; k++)
        {
          if(!this.tagCache.contains(newTags[k]))
          {
            this.tagCache.push(newTags[k])
          }
        }

		    const propertyList = Object.keys(this.settings.autoCompleteFields);
        for(let i = 0; i < propertyList.length; i++)
        {
          const field = propertyList[i];

          if(!this.propertyCache[field])
          {
            this.propertyCache[field] = [];
          }

          const newTags = getTags(cache, field);
          for(let k = 0; k < newTags.length; k++)
          {
            if(!this.propertyCache[field].contains(newTags[k]))
            {
              this.propertyCache[field].push(newTags[k]);
            }
          }
        }
      }));

    // Image created
    this.registerEvent(this.app.vault.on("create", this.#imageRegister.bind(this)));

    // Image Renamed
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) =>
      {
        this.#imageRegister(file);

        void (async () => {
          await sleep(300);

          const infoFile = await getImageInfo(oldPath, false, this);

          if(infoFile)
          {
            this.metaResources[file.path] = infoFile.path;
            delete this.metaResources[oldPath];

            // update the links in the meta file
            await this.app.vault.process(infoFile, (data) =>{
              data = data.replaceAll(oldPath, file.path);

              const oldUri = preprocessUri(oldPath)
              const newUri = preprocessUri(file.path)
              data = data.replaceAll(oldUri, newUri);

              return data;
            });
          }
        })();
      }));

    const options =  {capture: true}
    this.register(() => document.off('contextmenu', this.#imgSelector, this.clickImage, options));
    document.on('contextmenu', this.#imgSelector, this.clickImage, options);

    this.register(() => document.off('mousedown', this.#imgSelector, this.auxClick));
    document.on('mousedown', this.#imgSelector, this.auxClick);
  }

  #imageRegister(file:TAbstractFile)
  {
    if(!(file instanceof TFile))
    {
      return;
    }
    if(!EXTENSIONS.contains(file.extension.toLowerCase()))
    {
      return;
    }

    this.getImgResources()[this.app.vault.getResourcePath(file)] = file.path;
  }

  buildTagCache(): void
  {
    this.tagCache = [];
    this.propertyCache = {};
    const propertyList = Object.keys(this.settings.autoCompleteFields);
    for(let m = 0; m < propertyList.length; m++)
    {
      this.propertyCache[propertyList[m]] = [];
    }


		const files = this.app.vault.getMarkdownFiles();
		for(let i = 0; i < files.length; i++)
		{
      const cache = this.app.metadataCache.getFileCache(files[i]);
			const tags = getTags(cache);
			for(let k = 0; k < tags.length; k++)
			{
				if(!this.tagCache.contains(tags[k]))
				{
					this.tagCache.push(tags[k])
				}
			}

      for(let m = 0; m < propertyList.length; m++)
      {
        const field = propertyList[m];

        const newTags = getTags(cache, field);
        for(let k = 0; k < newTags.length; k++)
        {
          if(!this.propertyCache[field].contains(newTags[k]))
          {
            this.propertyCache[field].push(newTags[k]);
          }
        }
      }
    }
  }

  #buildImageCache()
  {
    this.imgResources = {};

		const vaultFiles = this.app.vault.getFiles()

		for (const file of vaultFiles)
		{
			if (EXTENSIONS.contains(file.extension.toLowerCase()))
			{
					this.imgResources[this.app.vault.getResourcePath(file)] = file.path
			}
		}
  }

	async #buildMetaCache(): Promise<void>
	{
		this.metaResources = {};
		const infoFolder = this.app.vault.getAbstractFileByPath(this.settings.imgDataFolder)

		if (infoFolder instanceof TFolder)
		{
			let cancel = false;
			const progress = new ProgressModal(this, infoFolder.children.length, ()=>{cancel = true;})
			progress.open();

			for (let i = 0; i < infoFolder.children.length; i++)
			{
				if(cancel)
				{
					new Notice(loc('CANCEL_LOAD_NOTICE'));
					return;
				}

				progress.updateProgress(i);

				const info = infoFolder.children[i];
        if(info instanceof TFile)
				{
          let imgLink = await getimageLink(info, this);

          if(info && imgLink)
          {
            this.metaResources[imgLink] = info.path
          }
        }
			}

			progress.updateProgress(infoFolder.children.length);
		}
	}

  #imgSelector: string = `.workspace-leaf-content[data-type='markdown'] img,`
                              +`.workspace-leaf-content[data-type='image'] img,`
                              +`.community-modal-details img,`
                              +`#sr-flashcard-view img,`
                              +`.workspace-leaf-content[data-type='markdown'] video,`
                              +`.workspace-leaf-content[data-type='video'] video,`
                              +`.community-modal-details video,`
                              +`.video-stream video`
                              +`#sr-flashcard-view video`;

  private clickImage = (event: MouseEvent): void =>
  {
    const targetEl = event.target as HTMLImageElement|HTMLVideoElement;
    if (!targetEl)
    {
      return;
    }

    if(targetEl.classList.contains("gallery-grid-img") || targetEl.classList.contains("gallery-grid-vid"))
    {
      return;
    }

    if(this.platformSettings().rightClickInfo)
    {
      void GalleryInfoView.OpenLeaf(this,targetEl.src);
    }

    if(this.platformSettings().rightClickMenu)
    {
      new ImageMenu(event.pageX, event.pageY, [targetEl], null, null, this);
    }
  }

  auxClick = (event: MouseEvent): void =>
  {
    if(event.button != 1)
    {
      return;
    }

    const targetEl = event.target as HTMLImageElement|HTMLVideoElement;
    if (!targetEl)
    {
      return;
    }

    void (async () => {
      const infoFile = await getImageInfo(targetEl.src, true, this);
      if(infoFile instanceof TFile)
      {
        void this.app.workspace.getLeaf(true).openFile(infoFile);
      }
    })();
  }

	#refreshColors()
	{
		const vaultWithConfig = this.app.vault as Vault & { getConfig?: (key: string) => string | undefined };
		const accent = vaultWithConfig.getConfig?.('accentColor');
		this.accentColor = accent ?? this.accentColor ?? '#7f6df2';
		this.accentColorDark = scaleColor(this.accentColor, 0.25);
		this.accentColorLight = scaleColor(this.accentColor, 1.5);

		// Colors are now handled via CSS variables in styles.css
		// using var(--interactive-accent) which Obsidian updates automatically
	}

  onunload()
  {
    console.debug(loc("UNLOADING_PLUGIN_MESSAGE", loc('PLUGIN_NAME')))

    this.embedQueue = {};
    this.finalizedQueue = {};
    this.tagCache = [];
    this.imgResources = {};
    this.metaResources = {};
  }

	async loadSettings()
	{
		const storedSettings = await this.loadData() as Partial<GallerySettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, storedSettings ?? {})
    let changed = false;
    for (let i = 0; i < this.settings.namedFilters.length; i++)
    {
      if(this.settings.namedFilters[i].filter.contains("="))
      {
        this.settings.namedFilters[i].filter = this.settings.namedFilters[i].filter.replaceAll("=",":");
        changed = true;
      }
    }

    if(changed)
    {
      void this.saveSettings();
    }
  }

  async saveSettings()
  {
    await this.saveData(this.settings)
  }

  galleryViewCreator(leaf: WorkspaceLeaf)
  {
    return new GalleryView(leaf, this)
  };

  galleryInfoCreator(leaf: WorkspaceLeaf)
  {
    return new GalleryInfoView(leaf, this)
  };

	showPanel = function (this: GalleryTagsPlugin)
	{
		const workspace = this.app.workspace
		void workspace.getLeaf(false).setViewState({ type: OB_GALLERY })
	};
}
