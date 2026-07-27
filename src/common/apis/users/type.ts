export type CurrentUserResponseData = ApiResponseData<{
  username: string
  roles: string[]
  permissions?: string[]
}>

export type RefreshTokenResponseData = ApiResponseData<{
  token: string
}>
