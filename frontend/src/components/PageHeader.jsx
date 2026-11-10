import { TEXT, PAGE } from '../constants/ui'

const PageHeader = ({ title, subtitle, actions }) => (
  <div className={PAGE.header}>
    <div className="flex items-start justify-between">
      <div>
        <h1 className="type-page-title tracking-tight text-[#121A14]">{title}</h1>
        {subtitle && <p className="type-body text-[#626C65] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  </div>
)

export default PageHeader
