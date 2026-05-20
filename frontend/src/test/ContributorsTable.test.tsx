import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import ContributorsTable from '../components/ContributorsTable'
import type { ContributorsResult } from '../lib/api'

const data: ContributorsResult = {
  totalPrs: 10,
  contributors: [
    { login: 'alice', pullsMerged: 5, commits: 20, linesAdded: 1000, linesDeleted: 200 },
    { login: 'bob',   pullsMerged: 2, commits: 8,  linesAdded: 300,  linesDeleted: 50  },
    { login: 'carol', pullsMerged: 8, commits: 35, linesAdded: 2500, linesDeleted: 800 },
  ],
}

function rowLogins() {
  return screen.getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent)
}

describe('ContributorsTable', () => {
  it('defaults to descending PRs merged order', () => {
    render(<ContributorsTable data={data} isLoading={false} />)
    expect(rowLogins()).toEqual(['carol', 'alice', 'bob'])
  })

  it('toggles to ascending on second click of the same column', async () => {
    render(<ContributorsTable data={data} isLoading={false} />)
    await userEvent.click(screen.getByText(/prs merged/i))
    expect(rowLogins()).toEqual(['bob', 'alice', 'carol'])
  })

  it('sorts alphabetically by login', async () => {
    render(<ContributorsTable data={data} isLoading={false} />)
    await userEvent.click(screen.getByText(/login/i))
    expect(rowLogins()).toEqual(['carol', 'bob', 'alice'])
    await userEvent.click(screen.getByText(/login/i))
    expect(rowLogins()).toEqual(['alice', 'bob', 'carol'])
  })

  it('shows empty state when no contributors', () => {
    render(<ContributorsTable data={{ totalPrs: 0, contributors: [] }} isLoading={false} />)
    expect(screen.getByText(/no contributors found/i)).toBeInTheDocument()
  })

  it('shows skeleton rows while loading', () => {
    render(<ContributorsTable data={undefined} isLoading={true} />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(5)
    rows.forEach((row) => {
      expect(within(row).getAllByRole('cell')[0].querySelector('.animate-pulse')).toBeInTheDocument()
    })
  })
})
