# Obsidian Smart Gallery
![GitHub release)](https://img.shields.io/github/v/release/oscarmlage/obsidian-smart-gallery)
![GitHub all releases](https://img.shields.io/github/downloads/oscarmlage/obsidian-smart-gallery/total)

- Main Gallery to tag / filter / add notes to images.
- Filter by frontmatter criteria and change the meta right in the side panel
- Display blocks to embed images inside notes
- Display block to an image information

## Usage

Add a gallery block to any note using the `gallery` code block. Here are some common examples:

### Basic gallery from a folder

````markdown
```gallery
path: Photos/Vacation
```
````

### Gallery with path pattern and reverse order

````markdown
```gallery
path: _assets/Laptop-screenshot*
reverseOrder: true
```
````

### Gallery filtered by tags

````markdown
```gallery
path: Images
tags: landscape -urban
exclusive: false
```
````

### Gallery with custom image width and sorting

````markdown
```gallery
path: Screenshots
imgWidth: 300
sort: mdate
reverseOrder: true
```
````

### Gallery with random selection

````markdown
```gallery
path: Wallpapers
random: 5
imgWidth: 400
```
````

### Gallery with multiple filters

````markdown
```gallery
path: Projects/Design
name: mockup
tags: approved
sort: name
imgWidth: 350
divWidth: 80
divAlign: center
```
````

For a complete list of options, see the [Display Blocks documentation](https://github.com/oscarmlage/obsidian-smart-gallery/blob/main/docs/README_DisplayBlocks.md).

## Examples:

### [Main Gallery](https://github.com/oscarmlage/obsidian-smart-gallery/blob/main/docs/README_MainGallery.md)
![](docs/images/Example_main_gallery.gif)

### [Display blocks](https://github.com/oscarmlage/obsidian-smart-gallery/blob/main/docs/README_DisplayBlocks.md)
![](docs/images/Example_Display_Block.gif)

### [Meta Files and Templates](https://github.com/oscarmlage/obsidian-smart-gallery/blob/main/docs/README_MetaFiles.md)
![](docs/images/MetaFile.png)

### [Context Menu](https://github.com/oscarmlage/obsidian-smart-gallery/blob/main/docs/README_ContextMenu.md)
![](docs/images/ContextMenu.png)

## [Tentative Roadmap](https://github.com/oscarmlage/obsidian-smart-gallery/blob/main/docs/README_Roadmap.md)



This is a continuation of developement from Darakah's obsidian-gallery, found here https://github.com/Darakah/obsidian-gallery
