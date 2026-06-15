import { useMutation } from '@tanstack/react-query'
import { createLiveAccount } from './registerApi'
import type { RegisterParams } from '../types'

export const useRegister = () =>
  useMutation({ mutationFn: (params: RegisterParams) => createLiveAccount(params) })
