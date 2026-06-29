import { TEXT, PAGE } from '../constants/ui'

const PageHeader = ({ title, subtitle, actions }) => (
  <div className={PAGE.header}>
    <div className="flex items-start justify-between">
      <div>
        <h1 className={TEXT.pageTitle}>{title}</h1>
        {subtitle && <p className={`${TEXT.secondary} mt-1`}>{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  </div>
)

export default PageHeader
