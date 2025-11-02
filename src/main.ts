import './style.css'

type GlobalState = {
  covers: Record<string, {
    slug: string
    label: string
    selected: boolean
    options: Record<string, {
      netPrice: {
        year: number
        month: number
      }
    }>
    discountOnRca?: {
      year: number
      month: number
    }
  }>
}

declare global {
  interface Window {
    state: GlobalState;
  }
}

function setSearchParam(key: string, value: string) {
  const qs = new URLSearchParams(window.location.search)
  qs.set(key, value)
  history.replaceState(null, "", `${document.location.href.split('?')[0]}?${qs.toString()}`);
  document.body.dispatchEvent(new CustomEvent('qs-updated', {
    detail: {
      key,
      value,
    }
  }))
}

function appendSearchParam(key: string, value: string) {
  const qs = new URLSearchParams(window.location.search)
  qs.append(key, value)
  history.replaceState(null, "", `${document.location.href.split('?')[0]}?${qs.toString()}`);
  document.body.dispatchEvent(new CustomEvent('qs-updated', {
    detail: {
      key,
      value,
    }
  }))
}

function delSearchParam(key: string, value: string) {
  const qs = new URLSearchParams(window.location.search)
  qs.delete(key, value)
  history.replaceState(null, "", `${document.location.href.split('?')[0]}?${qs.toString()}`);
  document.body.dispatchEvent(new CustomEvent('qs-updated', {
    detail: {
      key,
      value,
    }
  }))
}

function getSearchParam(key: string) {
  const qs = new URLSearchParams(window.location.search)
  return qs.get(key)
}

function getAllSearchParams(key: string) {
  const qs = new URLSearchParams(window.location.search)
  return qs.getAll(key)
}

function formatMoney(amount: number) {
  return amount.toFixed(2).replace('.', ',')
}

function getSelectedOptions(coverSlug: string) {
  const qs = new URLSearchParams(window.location.search)
  const coverOptionsKey = Array.from(qs.keys()).filter(key => key.includes(`option-${coverSlug}`))

  return coverOptionsKey.map(key => qs.get(key) || '').filter(Boolean)
}

function getCoverPrice(slug: string, installment = getSelectedInstallment()) {
  const cover = window.state.covers[slug];
  const discount = slug === 'rca' ? getRcaDiscount() : 0
  const coverOptions = getSelectedOptions(slug)
  const basePrice = coverOptions.reduce((tot, option) => tot + cover?.options[option].netPrice[installment || 0], 0)
  return basePrice - discount
}

function getCoverDiscountOnRca(slug: string) {
  const cover = window.state.covers[slug];
  const selectedInstallment = getSelectedInstallment();
  return cover?.discountOnRca?.[selectedInstallment]
}

let defaultInstallment = 'year'

function getSelectedInstallment() {
  return (getSearchParam('installment') || defaultInstallment) as 'year' | 'month'
}

function getRcaDiscount() {
  const selectedCovers = [...(new Set(['rca', ...getAllSearchParams('selected-cover')]))].map(slug => window.state.covers[slug])
  const rcaDiscount = selectedCovers.reduce((tot, cover) => tot + (cover.discountOnRca?.[getSelectedInstallment()] || 0), 0)
  return rcaDiscount
}

class Component extends HTMLElement {
  elements: Record<string, HTMLElement>

  constructor() {
    super()

    this.elements = Array.from(this.querySelectorAll('[data-id]'))?.reduce((result, el) => {
      let element = el as HTMLElement
      const key = element.dataset.id
      if (key) {
        result[key] = element
      }
      return result
    }, {} as Record<string, HTMLElement>)
  }

  renderOnQsChange(keys?: string[]) {
    this.on('qs-updated', (ev) => {
      if (keys?.includes(ev.detail.key) ?? true) {
        this.render()
      }
    })
  }

  on(event: string, cb: (ev: CustomEvent) => void) {
    document.body.addEventListener(event, cb as (ev: Event) => void)
  }

  setText(id: string, text: string) {
    if (this.elements[id]) {
      this.elements[id].innerText = text
    }
  }

  show(id: string) {
    if (this.elements[id]) {
      this.elements[id].hidden = false
    }
  }

  hide(id: string) {
    if (this.elements[id]) {
      this.elements[id].hidden = true
    }
  }

  render() {
    console.error('render is not implemented')
  }
}

customElements.define(
  'cover-card',
  class extends Component {
    slug: string

    constructor() {
      super()
      this.slug = this.dataset.slug || ''
    }

    connectedCallback() {
      this.render()
      this.renderOnQsChange()

      this.elements.addBtn?.addEventListener('click', () => {
        if (this.isSelected()) {
          delSearchParam('selected-cover', this.slug)
        } else {
          appendSearchParam('selected-cover', this.slug)
        }
      })

      Array.from(this.querySelectorAll('select')).forEach(select => {
        this.setOption(select)
        select.addEventListener('change', ev => {
          this.setOption(select)
        })
      })
    }

    setOption(select: HTMLSelectElement) {
      if (select.dataset.slug) { // temp
        setSearchParam(`option-${this.slug}-${select.dataset.slug}`, select.value)
      }
    }

    isSelected() {
      const selectedCovers = getAllSearchParams('selected-cover')
      return selectedCovers.includes(this.slug)
    }

    render() {
      this.updateRca()

      this.setText('netPrice', formatMoney(getCoverPrice(this.slug)))

      this.updateDiscountBox()
    }

    updateRca() {
      if (this.elements.addBtn) {
        if (this.isSelected()) {
          this.setText('addBtn', 'Rimuovi')
          this.elements.addBtn.classList.remove('button--secondary')
          this.elements.addBtn.classList.add('button--ghost')
        } else {
          this.setText('addBtn', 'Aggiungi')
          this.elements.addBtn.classList.add('button--secondary')
          this.elements.addBtn.classList.remove('button--ghost')
        }
      }
    }

    updateDiscountBox() {
      if (this.isSelected()) {
        this.show('appliedDiscountBox')
        this.hide('discountBox')
      } else {
        this.hide('appliedDiscountBox')
        this.show('discountBox')
      }

      const coverDiscountOnRca = getCoverDiscountOnRca(this.slug)
      if (coverDiscountOnRca) {
        this.setText('rcaDiscount', formatMoney(coverDiscountOnRca))
        this.setText('rcaDiscountApplied', formatMoney(coverDiscountOnRca))
        this.setText('discountInstallmentLabel', getSelectedInstallment() === 'year' ? "all'anno" : 'al mese')
      }
    }
  }
)

customElements.define(
  'covers-list-recap',
  class extends Component {
    template: DocumentFragment
    constructor() {
      super()

      const template = this.querySelector('template')?.content
      if (!template) {
        throw new Error('covers-list-recap must include a <template>')
      }
      this.template = template
    }

    connectedCallback() {
      this.render()
      this.renderOnQsChange()
    }

    render() {
      const selectedCovers = new Set(['rca', ...getAllSearchParams('selected-cover')])
      this.removeCovers()
      selectedCovers.forEach(this.addCover.bind(this))
    }

    removeCovers() {
      this.innerHTML = ''
    }

    addCover(slug: string) {
      const template = this.template.cloneNode(true) as DocumentFragment;
      const cover = window.state.covers[slug];
      (template.querySelector('[data-id="cover-name"]')! as HTMLElement).innerText = cover.label;

      (template.querySelector('[data-id="cover-price"]')! as HTMLElement).innerText = formatMoney(getCoverPrice(slug));
      (template.children[0]! as HTMLElement).dataset.coverSlug = cover.slug;
      this.appendChild(template);
    }
  }
)

customElements.define(
  'installment-switcher',
  class extends Component {
    constructor() {
      super()

      defaultInstallment = this.elements.yearRadio?.querySelector('input[checked]') ? 'year' : 'month'
      setSearchParam('installment', defaultInstallment)
    }

    connectedCallback() {
      this.render()
      this.renderOnQsChange()

      this.elements.yearRadio?.addEventListener('click', () => {
        setSearchParam('installment', 'year')
      })
      this.elements.monthRadio?.addEventListener('click', () => {
        setSearchParam('installment', 'month')
      })
    }

    render() {
      const selectedInstallment = getSelectedInstallment()
      this.elements.yearRadio.querySelector('input')!.checked = selectedInstallment === 'year'
      this.elements.monthRadio.querySelector('input')!.checked = selectedInstallment === 'month'

      const selectedCovers = [...(new Set(['rca', ...getAllSearchParams('selected-cover')]))]
      const [netTotalYearly, netTotalMonthly] =
        selectedCovers.reduce(([netTotalYearly, netTotalMonthly], slug) =>
          [netTotalYearly + getCoverPrice(slug, 'year'), netTotalMonthly + getCoverPrice(slug, 'month')],
          [0, 0])
      this.setText('netPriceMonthly', formatMoney(netTotalMonthly))
      this.setText('netPriceYearly', formatMoney(netTotalYearly))
    }
  }
)