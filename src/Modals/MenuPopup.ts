import { offScreenPartial, screenOffset, sleep } from "../utils";

declare function createDiv(options?: { cls?: string; text?: string }): HTMLDivElement;
declare const activeWindow: Window;

export class MenuPopup
{
	#onResult: (result:string) => void
	#self: HTMLDivElement
	#optionsArea: HTMLDivElement
	#selected: HTMLDivElement


	constructor(posX:number, posY:number, onResult: (result:string) => void)
	{
		this.#onResult = onResult;
		this.#self = createDiv({cls: "suggestion-container"})
		this.#optionsArea = this.#self.createDiv({cls: "menu-popup-options-area"});
		this.#self.tabIndex = 0;


		this.#self.addEventListener("blur", () =>
		{
			void (async () => {
				await sleep(100);
				this.#cleanUp();
			})();
		});

		this.#self.addEventListener("mouseleave", () =>
		{
			this.#cleanUp();
		});
	}

	AddLabel(label:string, color:string = null)
	{
		const info = this.#optionsArea.createDiv({cls: "suggestion-item menu-popup-break-word"});
		info.innerText = label;

		if(color)
		{
			info.setCssStyles({ color: color });
		}
	}

	addSeparator(color:string = null)
	{
		const line = this.#optionsArea.createDiv({cls: "suggestion-item-separator"});

		if(color)
		{
			line.setCssStyles({ color: color });
		}
	}

	addItem(label: string, command:string, color:string = null)
	{
		const item = this.#optionsArea.createDiv({cls: "suggestion-item menu-popup-break-word"});
		item.textContent = label;
		item.dataset.href = command;

		item.addEventListener("mouseover", () => {
			this.#select(item)
		});

		item.addEventListener("mousedown", () => {
			this.#submit();
		})

		if(color)
		{
			item.setCssStyles({ color: color });
		}
	}

	#select(item: HTMLDivElement)
	{
		if(this.#selected)
		{
			this.#selected.removeClass("is-selected");
		}

		this.#selected = item;

		if(item == null)
		{
			return;
		}

		item.addClass("is-selected");
	}

	#submit()
	{
		let result: string = null;
		if(this.#selected)
		{
			result = this.#selected.dataset.href;
		}

		this.#cleanUp();

		this.#onResult(result);
	}

	show(posX:number,posY:number)
	{
		activeWindow.document.body.appendChild(this.#self);

		this.#self.setCssStyles({ left: (posX)+"px", top: (posY)+"px" });

		const optionsRect = this.#optionsArea.getBoundingClientRect();
		this.#self.setCssStyles({ width: optionsRect.width+"px" });

		if(offScreenPartial(this.#self))
		{
			let x, y;
			[x,y] = screenOffset(this.#self);
			this.#self.setCssStyles({ left: (posX+x)+"px", top: (posY+y)+"px" });
		}

		this.#self.focus();
	}

	#cleanUp()
	{
		this.#select(null);

		if(this.#self)
		{
			this.#self.remove();
		}
	}
}