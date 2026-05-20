import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import RepoForm from '../components/RepoForm'

function setup() {
  const onSubmit = vi.fn()
  render(<RepoForm onSubmit={onSubmit} />)
  return {
    onSubmit,
    owner: () => screen.getByLabelText(/owner/i),
    repo: () => screen.getByLabelText(/repo/i),
    from: () => screen.getByLabelText(/from/i),
    to: () => screen.getByLabelText(/to/i),
    submit: () => screen.getByRole('button', { name: /analyze/i }),
  }
}

function setDate(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

describe('RepoForm', () => {
  it('rejects whitespace-only owner', async () => {
    const { onSubmit, owner, repo, submit } = setup()
    await userEvent.clear(owner())
    await userEvent.type(owner(), '   ')
    await userEvent.type(repo(), 'react')
    await userEvent.click(submit())
    expect(screen.getByText('Owner cannot be empty.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects whitespace-only repo', async () => {
    const { onSubmit, owner, repo, submit } = setup()
    await userEvent.type(owner(), 'facebook')
    await userEvent.clear(repo())
    await userEvent.type(repo(), '   ')
    await userEvent.click(submit())
    expect(screen.getByText('Repo cannot be empty.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects from >= to', async () => {
    const { onSubmit, owner, repo, from, to, submit } = setup()
    await userEvent.type(owner(), 'facebook')
    await userEvent.type(repo(), 'react')
    setDate(from(), '2024-03-01')
    setDate(to(), '2024-01-01')
    await userEvent.click(submit())
    expect(screen.getByText('"From" date must be before "To" date.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects date range over 365 days', async () => {
    const { onSubmit, owner, repo, from, to, submit } = setup()
    await userEvent.type(owner(), 'facebook')
    await userEvent.type(repo(), 'react')
    setDate(from(), '2023-01-01')
    setDate(to(), '2024-12-31')
    await userEvent.click(submit())
    expect(screen.getByText('Date range cannot exceed 365 days.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('trims owner and repo before calling onSubmit', async () => {
    const { onSubmit, owner, repo, from, to, submit } = setup()
    await userEvent.type(owner(), '  facebook  ')
    await userEvent.type(repo(), '  react  ')
    setDate(from(), '2024-01-01')
    setDate(to(), '2024-03-01')
    await userEvent.click(submit())
    expect(onSubmit).toHaveBeenCalledWith(
      'facebook',
      'react',
      new Date('2024-01-01'),
      new Date('2024-03-01'),
    )
  })
})
