import type { Vault } from 'obsidian'
import type GalleryTagsPlugin from '../main'
import { MediaSearch } from '../TechnicalFiles/MediaSearch'
import { MediaGrid } from '../DisplayObjects/MediaGrid'
import Gallery from '../svelte/Gallery.svelte'
import { validString } from '../utils'
import { parseAdvanceSearch } from '../TechnicalFiles/GrammarParse'

export interface GalleryBlockArgs
{
  type: string
  filter: string
  exclusive: string
  matchCase: string
  imgWidth: number
  imgHeight: number
  divWidth: number
  divAlign: string
  divHeight: number
  sort: string
  reverseOrder: string
  customList: string
  random: number
}

export class GalleryBlock
{
  async galleryDisplay(source: string, el: HTMLElement, vault: Vault, plugin: GalleryTagsPlugin)
  {
    const args: GalleryBlockArgs = {
      type: 'grid',
      filter: null,
      exclusive: null,
      matchCase: null,
      imgWidth: -1,
      imgHeight: -1,
      divWidth: 100,
      divAlign: 'left',
      divHeight: -1,
      sort: null,
      reverseOrder: null,
      customList: null,
      random: -1
    };

    let other:string = "";
    // TODO: handle new line in field info
    source.split('\n').map(e =>
    {
      if (e)
      {
        const param = e.trim().split(':');
        const key = param[0] as keyof GalleryBlockArgs;
        if(Object.prototype.hasOwnProperty.call(args, key))
        {
          const value = param[1]?.trim();
          if (key === 'imgWidth' || key === 'imgHeight' || key === 'divWidth' || key === 'divHeight' || key === 'random') {
            args[key] = parseInt(value) || -1;
          } else if (key === 'type' || key === 'filter' || key === 'exclusive' || key === 'matchCase' || key === 'divAlign' || key === 'sort' || key === 'reverseOrder' || key === 'customList') {
            args[key] = value;
          }
        }
        else
        {
          other += e + "\n";
        }
      }
    })

    const elCanvas = el.createDiv({
      cls: 'ob-gallery-display-block',
      attr: { style: `width: ${args.divWidth}%; height: ${(args.divHeight >10 )? args.divHeight+"px" : "auto"}; float: ${args.divAlign}` }
    })
    
    const mediaSearch = new MediaSearch(plugin);

    if(validString(args.filter))
    {
      if(/([lL][aA][sS][tT][_ ]?[uU][sS][eE][dD])/.exec(args.filter) != null)
      {
        if(validString(plugin.platformSettings().lastFilter))
        {
          mediaSearch.setFilter(plugin.platformSettings().lastFilter);
        }
      }
      else
      {
        mediaSearch.setNamedFilter(args.filter);
      }
    }
    
    parseAdvanceSearch(other,mediaSearch);

    if(validString(args.sort))
    {
      mediaSearch.stringToSort(args.sort);
    }
    if(validString(args.reverseOrder))
    {
      mediaSearch.reverse = args.reverseOrder === 'true';
    }
    if(args.imgWidth >= 0)
    {
      mediaSearch.maxWidth = args.imgWidth;
    }
    if(args.imgHeight >= 0)
    {
      mediaSearch.maxHeight = args.imgHeight;
    }
    if(validString(args.exclusive))
    {
      mediaSearch.exclusive = args.exclusive === 'true';
    }
    if(validString(args.matchCase))
    {
      mediaSearch.matchCase = args.matchCase === 'true';
    }
    if(args.random >= 0)
    {
      mediaSearch.random = args.random;
    }
    
    if (validString(args.customList))
    {
      mediaSearch.customList = args.customList.split(' ').map(i => parseInt(i));
    }

    await mediaSearch.updateData();

    if (args.type === 'grid')
    {
      const mediaGrid = new MediaGrid(elCanvas, mediaSearch, plugin);
      void mediaGrid.updateDisplay();
      plugin.onResize = () =>
      {
        void mediaGrid.updateDisplay();
      }
      
      mediaGrid.setupClickEvents();
    }

    if (args.type === 'active-thumb')
    {
      new Gallery({
        props: {
          imgList: mediaSearch.imgList,
          width: args.imgWidth / 50,
          fillFree: true
        },
        target: elCanvas
      })
    }
  }
}
