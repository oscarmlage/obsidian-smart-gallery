import type { App, CachedMetadata, FrontMatterCache, TAbstractFile } from 'obsidian'
import { TFile, normalizePath, Notice, Platform, getAllTags } from 'obsidian'
import type GalleryTagsPlugin from './main'
import { ExifData, ExifParserFactory } from 'ts-exif-parser'
import { extractColors } from 'extract-colors'
import { EXTENSIONS, EXTRACT_COLORS_OPTIONS, VIDEO_REGEX, DEFAULT_TEMPLATE } from './TechnicalFiles/Constants'
import { loc } from './Loc/Localizer'
import type en from './Loc/Languages/en'

export type ImageResources = Record<string, string>

/**
 * Utility function to delay execution
 * @param ms - milliseconds to wait
 */
export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export const scaleColor = (color: string, percent: number) : string =>
{
  let rcode = color.substring(1,3);
  let gcode = color.substring(3,5);
  let bcode = color.substring(5,7);
  let r = parseInt(rcode, 16);
  let g = parseInt(gcode, 16);
  let b = parseInt(bcode, 16);

  r *= percent;
  g *= percent;
  b *= percent;

  rcode = Math.ceil(Math.clamp(r,0,255)).toString(16).padStart(2, '0');
  gcode = Math.ceil(Math.clamp(g,0,255)).toString(16).padStart(2, '0');
  bcode = Math.ceil(Math.clamp(b,0,255)).toString(16).padStart(2, '0');
  return "#"+rcode+gcode+bcode
}

/**
 * Return initial img info file content
 * @param imgPath - Relative vault path of related image
 */
const initializeInfo = (template: string, imgPath: string, imgName: string): string =>
{
  if(!validString(template))
  {
    template = DEFAULT_TEMPLATE;
  }
  const uri = preprocessUri(imgPath);
  const infoBlock = "```gallery-info\nimgPath="+imgPath+"\n```";
  const link = "["+imgName+"]("+uri+")";
  const embed = "![]("+uri+")";
  let final = template;

  final = final.replaceAll(new RegExp(/<%\s*(I|i)(M|m)(G|g)\s*(L|l)(I|i)(N|n)(K|k)\s*%>/g), link);
  final = final.replaceAll(new RegExp(/<%\s*(I|i)(M|m)(G|g)\s*(E|e)(M|m)(B|b)(E|e)(D|d)\s*%>/g), embed);
  final = final.replaceAll(new RegExp(/<%\s*(I|i)(M|m)(G|g)\s*(I|i)(N|n)(F|f)(O|o)\s*%>/g), infoBlock);
  final = final.replaceAll(new RegExp(/<%\s*(I|i)(M|m)(G|g)\s*(U|u)(R|r)(I|i)\s*%>/g), uri);
  final = final.replaceAll(new RegExp(/<%\s*(I|i)(M|m)(G|g)\s*(P|p)(A|a)(T|t)(H|h)\s*%>/g), imgPath);
  final = final.replaceAll(new RegExp(/<%\s*(I|i)(M|m)(G|g)\s*(N|n)(A|a)(M|m)(E|e)\s*%>/g), imgName);

  return final;
}

export const preprocessUri = (original: string): string =>
{
  const uri = original.replaceAll(' ', '%20');

  return uri;
}

export const validString = (original: string, minLength:number = 0): boolean =>
{
  if(original === undefined || original === null)
  {
    return false;
  }

  if(typeof original !== 'string')
  {
    return false;
  }

  if(original.trim().length <= minLength)
  {
    return false;
  }

  return true;
}

/**
 * Open the search window to a query.
 * !!!This uses unsafe internal references and may break at any time!!!
 * @param someSearchQuery text of the query
 * @param app ref to the app
 */
export const getSearch = (someSearchQuery: string, app: App): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  (app as any).internalPlugins.getPluginById('global-search').instance.openGlobalSearch(someSearchQuery);
}

/**
 * Figures out if the element is partially offscreen
 * @param el element to check
 * @returns
 */
export const offScreenPartial = function(el:HTMLElement) : boolean
{
  const rect = el.getBoundingClientRect();
  const a = (rect.x + rect.width) > window.innerWidth
  const b = (rect.y + rect.height) > window.innerHeight
  const c = rect.x < 0
  const d = rect.y < 0
  return a || b || c || d;
};

/**
 * Figures out if the element is partially offscreen
 * @param el element to check
 * @returns
 */
export const screenOffset = function(el:HTMLElement) : [number,number] {
  const rect = el.getBoundingClientRect();
  let x = 0;
  let y = 0;
  const a = (rect.x + rect.width) - window.innerWidth
  if(a > 0)
  {
    x = -a;
  }
  const b = (rect.y + rect.height) - window.innerHeight
  if(b > 0)
  {
    y = -b;
  }
  if(rect.x < 0)
  {
    x = -rect.x;
  }
  if(rect.y < 0)
  {
    y = -rect.y;
  }
  return [x,y];
};

export const offscreenFull = function(el:HTMLElement) : boolean {
  const rect = el.getBoundingClientRect();
  return (
           (rect.x + rect.width) < 0
             || (rect.y + rect.height) < 0
             || (rect.x > window.innerWidth
              || rect.y > window.innerHeight)
         );
};

/**
 * get the meta file for an image
 * @param imgPath patht o the image the meat is for
 * @param create if it does not exist should we create one?
 * @param plugin reference to the plugin
 * @returns null if no file exists and we were not told we could create it
 */
export const getImageInfo = async (imgPath:string, create:boolean, plugin: GalleryTagsPlugin): Promise<TFile|null> =>
{
  if(plugin.settings.imgDataFolder == null)
  {
    return null;
  }

  if(!validString(imgPath))
  {
    return null;
  }

  if(imgPath.contains("app://") || imgPath.contains("http://localhost"))
  {
    imgPath = plugin.getImgResources()[imgPath];
    if(!validString(imgPath))
    {
      const warning = loc('MISSING_RESOURCE_WARNING', imgPath)
      console.warn(warning);
      new Notice(warning);
      return;
    }
  }
  // Remote URLs are supported but we don't use the remote flag currently
  // else if(imgPath.contains("http://") || imgPath.contains("https://"))
  // {
  //   // remote = true;
  // }

  let infoFile = null
  let infoPath = plugin.getMetaResources()[imgPath];
  infoFile = plugin.app.vault.getAbstractFileByPath(infoPath);

  if(infoFile instanceof TFile)
  {
    return infoFile;
  }

  if (create)
  {
    infoFile = await createMetaFile(imgPath, plugin);
    plugin.getMetaResources()[imgPath] = infoFile.path
    return infoFile;
  }

  // Not found, don't create
  return null
}


export const createMetaFile = async (imgPath:string,plugin:GalleryTagsPlugin): Promise<TFile> =>
{
  // Info File does not exist, Create it
  let counter = 1
  const imgName = imgPath.split('/').slice(-1)[0]
  let fileName = imgName.substring(0, imgName.lastIndexOf('.'))
  let filepath = normalizePath(`${plugin.settings.imgDataFolder}/${fileName}.md`);
  let infoFile: TAbstractFile;

  while ((infoFile = plugin.app.vault.getAbstractFileByPath(filepath)) instanceof TFile)
  {
    let imgLink = await getimageLink(infoFile, plugin);
    if(imgLink == imgPath)
    {
      return infoFile;
    }
    filepath = normalizePath(`${plugin.settings.imgDataFolder}/${fileName}_${counter}.md`);
    counter++;
  }


  const templateTFile = plugin.app.vault.getAbstractFileByPath(normalizePath(plugin.settings.imgmetaTemplatePath+".md"));
  let template = DEFAULT_TEMPLATE;
  if(templateTFile instanceof TFile)
  {
    template = await plugin.app.vault.read(templateTFile);
  }

  plugin.embedQueue[filepath] = imgPath;

  try
  {
    return await plugin.app.vault.create(filepath, initializeInfo(template, imgPath, imgName));
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  catch(_e)
  {
    infoFile = plugin.app.vault.getAbstractFileByPath(filepath);
    if(infoFile instanceof TFile)
    {
      return infoFile;
    }

    const warning = loc('META_OVERWRITE_CONFLICT', imgPath, filepath);
    console.warn(warning);
    new Notice(warning);
  }
}

export const getimageLink = async (info: TFile, plugin: GalleryTagsPlugin) : Promise<string> =>
{
  let imgLink: string;
  if (info instanceof TFile)
  {
    const fileCache = plugin.app.metadataCache.getFileCache(info)
    const frontmatter = fileCache?.frontmatter;
    const targetImage = frontmatter?.targetImage as string | undefined;
    if(targetImage && targetImage.length > 0)
    {
      imgLink = targetImage
    }
    else
    {
      // find the info block and get the text from there
      const cache = plugin.app.metadataCache.getFileCache(info);
      const cacheFrontmatter = cache?.frontmatter;
      const cacheTargetImage = cacheFrontmatter?.targetImage as string | undefined;
      if(cacheFrontmatter && !(cacheTargetImage && cacheTargetImage.length > 0))
      {
        const infoContent = await plugin.app.vault.read(info);
        const match = /img(P,p)ath=.+/.exec(infoContent)
        if(match)
        {
          imgLink = match[0].trim().substring(8);
          imgLink = normalizePath(imgLink);

          void plugin.app.fileManager.processFrontMatter(info, (fm) =>
          {
            (fm as Record<string, unknown>).targetImage = imgLink;
          });
        }
      }
    }
  }

  return imgLink;
}

export const isRemoteMedia = (source:string): boolean =>
{
  return source.contains("http://")
  || source.contains("https://");
}

/**
 * Attempt to scrape the remote target for info and add them to the meta
 * @param imgPath path of media to target
 * @param infoTFile meta file to add info to
 * @param plugin reference to the plugin
 */
export const addRemoteMeta = async (imgPath: string, infoTFile: TFile, plugin: GalleryTagsPlugin): Promise<boolean> =>
{
  const data = plugin.app.metadataCache.getFileCache(infoTFile)
  if(!data)
  {
    return false;
  }

  const frontmatter = data.frontmatter;
  const targetImage = frontmatter?.targetImage as string | undefined;
  const shouldLink = !(targetImage && targetImage.length > 0)

  if(shouldLink)
  {
    void plugin.app.fileManager.processFrontMatter(infoTFile, (fm) =>
    {
      if(shouldLink)
      {
        (fm as Record<string, unknown>).targetImage = imgPath;
      }
    });
    return true;
  }

  return false;
}

/**
 * Attempt to scrape the file for tags and add them to the meta
 * @param imgTFile file to scrape
 * @param infoTFile meta file to add tags to
 * @param plugin reference to the plugin
 */
export const addEmbededTags = async (imgTFile: TFile, infoTFile: TFile, plugin: GalleryTagsPlugin): Promise<boolean> =>
{
  let keywords: string[];
  const data = plugin.app.metadataCache.getFileCache(infoTFile)
  if(!data)
  {
    return false;
  }

  const frontmatter = data.frontmatter;
  const existingTags = frontmatter?.tags as string[] | undefined;
  const existingPalette = frontmatter?.Palette as string[] | undefined;
  const existingTargetImage = frontmatter?.targetImage as string | undefined;

  if(!plugin.settings.skipMetadataOverwrite || !(existingTags && existingTags.length > 0))
  {
    keywords = await getJpgTags(imgTFile, plugin);
  }
  const shouldColor =(!imgTFile.path.match(VIDEO_REGEX)
  && Platform.isDesktopApp
  && !(existingPalette && existingPalette.length > 0))

  const shouldLink = !(existingTargetImage && existingTargetImage.length > 0)
  let colors: string[] = []

  if(shouldColor)
  {
    const measureEl = new Image();
    measureEl.src = plugin.app.vault.getResourcePath(imgTFile);

    const colorstemp = await extractColors(measureEl, EXTRACT_COLORS_OPTIONS)
    for (let i = 0; i < colorstemp.length; i++)
    {
      colors.push(colorstemp[i].hex);
    }
  }

  if(shouldLink || keywords || shouldColor)
  {
    void plugin.app.fileManager.processFrontMatter(infoTFile, (fm) =>
    {
      const fmRecord = fm as Record<string, unknown>;
      if(shouldLink)
      {
        fmRecord.targetImage = imgTFile.path;
      }

      if(keywords)
      {
        let field:string;
        if(validString(plugin.settings.alternativeTags))
        {
          field = plugin.settings.alternativeTags;
        }
        else
        {
          field = 'tags';
        }

        let tags = getTags(data, field);
        let newTags = false;
        for (let i = 0; i < keywords.length; i++)
        {
          const tag = keywords[i].trim();
          if(!validString(tag))
          {
            continue;
          }
          if(tags.contains(tag))
          {
            continue;
          }

          newTags = true;
          tags.push(tag);
        }

        if(newTags)
        {
          setTags(fm as FrontMatterCache, tags, field);
          fmRecord.tags = tags;
        }
      }

      // Get image colors
      if (shouldColor)
      {
        const hexList: string[] = [];

        for(let i = 0; i < colors.length; i++)
        {
          hexList.push(colors[i]);
        }

        fmRecord.Palette = hexList;
      }
    });
    return true;
  }

  return false;
}

export const addTag = async (imageInfo:TFile, tag:string, plugin:GalleryTagsPlugin, field:string = 'tags' ): Promise<void> =>
{
  await plugin.app.fileManager.processFrontMatter(imageInfo, (fm) =>
  {
    let tags = getFrontTags(fm as FrontMatterCache, field);
    if (!Array.isArray(tags))
    {
      tags = [tags];
    }

    if(tags.contains(tag))
    {
      return;
    }

    tags.push(tag);
    setTags(fm as FrontMatterCache, tags, field);
  });
}

export const removeTag = async (imageInfo:TFile, tag:string, plugin:GalleryTagsPlugin, field:string = 'tags' ): Promise<void> =>
{
  await plugin.app.fileManager.processFrontMatter(imageInfo, (fm) =>
  {
    let tags = getFrontTags(fm as FrontMatterCache, field);
    if (!Array.isArray(tags))
    {
      tags = [tags];
    }

    let change = false;
    const tagNoHash = tag.replace('#','');
    const tagAddHash = '#'+tag;

    if(tags.contains(tagNoHash))
    {
      tags.remove(tagNoHash);
      change = true;
    }
    if(tags.contains(tag))
    {
      tags.remove(tag);
      change = true;
    }
    if(tags.contains(tagAddHash))
    {
      tags.remove(tagAddHash);
      change = true;
    }

    if(change)
    {
      setTags(fm as FrontMatterCache, tags, field);
    }
  });
}

const getFrontTags = (frontmatter:FrontMatterCache, field:string = 'tags'): string[] =>
{
  let tags:string[]
  if(!validString(field))
  {
    return tags;
  }

  const found = (frontmatter as Record<string, unknown>)[field] ?? [];

  if (!Array.isArray(found))
  {
    const stringValue = typeof found === 'object' && found !== null ? JSON.stringify(found) : String(found as string | number | boolean);
    tags = [stringValue];
  }
  else
  {
    tags = found as string[];
  }

  return tags;
}

export const getTags = (metaCache:CachedMetadata, field:string = 'tags'): string[] =>
{
  let tags:string[]
  if(!validString(field))
  {
    return tags;
  }

  let found: unknown;
  if(field == 'tags')
  {
    found = getAllTags(metaCache)
  }
  else
  {
    if(metaCache.frontmatter)
    {
      found = (metaCache.frontmatter as Record<string, unknown>)[field] ?? [];
    }
    else
    {
      found = [];
    }
  }

  if (!Array.isArray(found))
  {
    const stringValue = typeof found === 'object' && found !== null ? JSON.stringify(found) : String(found as string | number | boolean);
    tags = [stringValue];
  }
  else
  {
    tags = found as string[];
  }

  return tags;
}

export const setTags = (frontmatter:FrontMatterCache, tags:string[], field:string = 'tags') =>
{
  if(validString(field))
  {
    frontmatter[field] = tags;
  }
  else
  {
    // TODO: give info about why this failed
  }
}

const getJpgTags = async (imgTFile: TFile, plugin: GalleryTagsPlugin): Promise<string[]> =>
{
  if(!imgTFile)
  {
    return null;
  }

  let tagInfo: ExifData;

  try
  {
    const bits = await plugin.app.vault.readBinary(imgTFile)
    const parser = ExifParserFactory.create(bits);
    tagInfo = parser.parse();
  }
  catch(e: unknown)
  {
    if(e instanceof Error)
    {
      new Notice(e.message)
    }
    else
    {
      const errorMsg = typeof e === 'object' && e !== null ? JSON.stringify(e) : String(e as string | number | boolean);
      new Notice(errorMsg)
    }
  }

  if(!tagInfo || !tagInfo.tags || !tagInfo.tags.XPKeywords)
  {
    return null;
  }

  let found = ""
  if(Array.isArray(tagInfo.tags.XPKeywords) )
  {
    const enc = new TextDecoder("utf-8");
    const tagbinary = new Uint8Array(tagInfo.tags.XPKeywords as number[]).buffer
    found = enc.decode(tagbinary)
  }
  else
  {
    found = tagInfo.tags.XPKeywords;
  }

  if(found.contains("\0"))
  {
    const enc = new TextDecoder("utf-16");
    const tagbinary = new Uint16Array(tagInfo.tags.XPKeywords as unknown as number[]).buffer
    found = enc.decode(tagbinary)
  }

  if(found.contains("\0"))
  {
    found = found.replaceAll("\0","")
  }

  found = found.replaceAll(" ","_")

  return found.split(/[;,]/);
}

/**
 * used to find potential correct links for when a path has broken
 * @param path old path that is broken
 * @param plugin plugin ref
 * @returns list of file paths that match the file name
 */
export const searchForFile = async (path: string, plugin: GalleryTagsPlugin): Promise<string[]> =>
{
  const foundPaths: string[] = []
  const vaultFiles: TFile[] = plugin.app.vault.getFiles();
  const fileName: string = path.substring(path.lastIndexOf('/'));

  for (const file of vaultFiles)
  {
    if (EXTENSIONS.contains(file.extension.toLowerCase()) && file.path.contains(fileName) )
    {
      foundPaths.push(file.path);
    }
  }

  return foundPaths;
}

export const setLazyLoading = (): void =>
{
  const lazyImages = [].slice.call(document.querySelectorAll("img.lazy")) as HTMLImageElement[];
  const options = {
    root: document.querySelector("ob-gallery-display"),
    // rootMargin: "0px",
    // threshold: 1.0,
  };
  if ("IntersectionObserver" in window) {
    const lazyImageObserver = new IntersectionObserver(function(entries, observer)
    {
      entries.forEach(function(entry)
      {
        if (entry.isIntersecting)
        {
          if(entry.target instanceof HTMLImageElement)
          {
            entry.target.src = entry.target.dataset.src ?? '';
            entry.target.classList.remove("lazy");
            observer.unobserve(entry.target);
          }
        }
      });
    }, options);

    lazyImages.forEach(function(lazyImage) {
      lazyImageObserver.observe(lazyImage);
    });
  } else {
    // Possibly fall back to event handlers here
  }
}

export const updateFocus = (imgEl: HTMLImageElement, videoEl: HTMLVideoElement, src: string, isVideo: boolean): void =>
{
  if (isVideo)
  {
    // hide focus image div
    imgEl.addClass('gallery-focus-hidden')
    imgEl.removeClass('gallery-focus-visible')
    // Show focus video div
    videoEl.removeClass('gallery-focus-hidden')
    videoEl.addClass('gallery-focus-visible')
    // Clear Focus image
    imgEl.src = ''
    // Set focus video
    videoEl.src = src
    return;
  }

  // Show focus image div
  imgEl.removeClass('gallery-focus-hidden')
  imgEl.addClass('gallery-focus-visible')
  // Hide focus video div
  videoEl.addClass('gallery-focus-hidden')
  videoEl.removeClass('gallery-focus-visible')
  // Clear Focus video
  videoEl.src = ''
  // Set focus image
  imgEl.src = src
};



export const ToastMessage = (msg: string, timeoutInSeconds = 10, contextMenuCallback?:()=>void, contextKey:keyof typeof en = 'CONTEXT_INFO'): void =>
{
  const additionalInfo = contextMenuCallback  ?  (Platform.isDesktop ? loc('TOAST_ADDITIONAL_CONTEXT', loc(contextKey)) : loc('TOAST_ADDITIONAL')) : "";
  const newNotice: Notice = new Notice(`${loc('PLUGIN_NAME')}\n${msg}\n${additionalInfo}`, timeoutInSeconds*1000);
  //@ts-ignore - messageEl is the correct API but types may not be updated
  if(contextMenuCallback) newNotice.messageEl.oncontextmenu = () => { contextMenuCallback() };
}