export interface ConfigData {
  epay_url: string
  epay_pid: string
  epay_key: string
  site_url: string
  site_name: string
  plan_month_price: string
  plan_quarter_price: string
  plan_year_price: string
  plan_lifetime_price: string
  [key: string]: string
}

export type ConfigResponseData = ApiResponseData<ConfigData>
