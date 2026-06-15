import { useQuery } from '@tanstack/react-query'
import { getCountries } from './countriesApi'

export const useCountries = () =>
  useQuery({ queryKey: ['countries'], queryFn: getCountries, staleTime: Infinity })
