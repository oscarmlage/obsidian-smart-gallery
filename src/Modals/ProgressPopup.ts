import { Modal, Setting } from "obsidian";
import type GalleryTagsPlugin from "../main";
import { loc } from '../Loc/Localizer'

export class ProgressModal extends Modal 
{
	#plugin: GalleryTagsPlugin
	#onCancel: () => void
	#complete: boolean = false
	#total: number
	#progressEl: HTMLDivElement
	#settingEl: Setting

	constructor(plugin: GalleryTagsPlugin, total: number, onCancel: () => void) 
	{
		super(plugin.app);
		this.#plugin = plugin;
		this.#onCancel = onCancel;
		this.#total = total;
	}

	updateProgress(complete:number)
	{
		if(complete >= this.#total-1)
		{
			this.#complete = true;
			this.close();
			return;
		}

		if(complete == 0)
		{
			return;
		}

		this.#progressEl.style.width = (complete*100/this.#total)+"%";
		this.#settingEl.descEl.innerText = `${complete}/${this.#total}`;
	}

	onOpen() 
	{
		const { contentEl } = this;

		const bar = contentEl.createDiv({cls: "progress-popup-bar"});

		this.#progressEl = bar.createDiv({cls: "progress-popup-fill"});
		this.#progressEl.style.backgroundColor = this.#plugin.accentColor;

		if(this.#onCancel)
		{
			this.#settingEl = new Setting(contentEl)
			.setDesc('')
			.addButton((btn) =>
			btn
			.setButtonText(loc('CANCEL'))
			.setCta()
			.onClick(() => {
				this.#onCancel();
				this.#complete = true;
				this.close();
			}));
		}
	}

	onClose() 
	{
		if(!this.#complete && this.#onCancel)
		{
			this.#onCancel();
		}

		let { contentEl } = this;
		contentEl.empty();
	}
}