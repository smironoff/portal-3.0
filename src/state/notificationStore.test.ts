import { describe, it, expect, beforeEach } from 'vitest'
import { useNotificationStore } from './notificationStore'

describe('notificationStore', () => {
  beforeEach(() => useNotificationStore.setState({ items: [] }))

  it('adds and removes notifications', () => {
    const id = useNotificationStore.getState().push({ severity: 'error', message: 'boom' })
    expect(useNotificationStore.getState().items).toHaveLength(1)
    useNotificationStore.getState().dismiss(id)
    expect(useNotificationStore.getState().items).toHaveLength(0)
  })
})
