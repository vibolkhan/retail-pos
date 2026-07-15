// src/stores/branch.ts
import type { Branch } from '@/types/pos'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getBranches } from '@/composables/useSupabase'
import { useAppStore } from '@/stores/app'

function storedBranchId (): number | null {
  const raw = localStorage.getItem('activeBranchId')
  const id = Number(raw)
  return raw !== null && Number.isInteger(id) ? id : null
}

export const useBranchStore = defineStore('branch', () => {
  const branches = ref<Branch[]>([])
  // Active branch – persisted in localStorage
  const activeBranchId = ref<number | null>(storedBranchId())

  const activeBranch = computed<Branch | null>(
    () => branches.value.find(b => b.id === activeBranchId.value) ?? null,
  )

  const isWholesale = computed(() => activeBranch.value?.type === 'wholesale')

  function setActiveBranch (id: number) {
    if (activeBranchId.value === id) {
      return
    }
    activeBranchId.value = id
    localStorage.setItem('activeBranchId', String(id))
    // Each branch keeps its own cart
    useAppStore().reloadCartForBranch(id)
  }

  async function loadBranches () {
    if (branches.value.length > 0) {
      return
    }
    branches.value = await getBranches()
    // Default to the retail branch when nothing valid is selected yet
    if (!branches.value.some(b => b.id === activeBranchId.value)) {
      const retail = branches.value.find(b => b.type === 'retail') ?? branches.value[0]
      if (retail) {
        setActiveBranch(retail.id)
      }
    }
  }

  return { branches, activeBranchId, activeBranch, isWholesale, loadBranches, setActiveBranch }
})
