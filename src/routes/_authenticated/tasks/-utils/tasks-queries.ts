import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseBrowserClient } from '#/libs/supabase/client'
import { useTasksStore } from '#/stores/tasks-store'
import type { Task, TaskList, Subtask } from '#/stores/tasks-store'

const TASKS_QUERY_KEY = ['tasks']

export function useTasksQuery() {
  const setTasks = useTasksStore((s) => s.setTasks)
  const setLists = useTasksStore((s) => s.setLists)

  return useQuery({
    queryKey: TASKS_QUERY_KEY,
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient()

      // Fetch lists
      const { data: lists, error: listsError } = await supabase
        .from('task_lists')
        .select('*')
        .order('order', { ascending: true })

      if (listsError) throw listsError

      // Fetch tasks with subtasks
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*, subtasks(*)')
        .order('order', { ascending: true })

      if (tasksError) throw tasksError

      // Transform data to match client schema
      const transformedTasks: Task[] = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        notes: t.notes,
        listId: t.list_id,
        starred: t.starred,
        completed: t.completed,
        completedAt: t.completed_at,
        deadline: t.deadline,
        subtasks: (t.subtasks || []).map((s: any) => ({
          id: s.id,
          title: s.title,
          completed: s.completed,
          notes: s.notes,
          deadline: s.deadline,
        })),
        order: t.order,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }))

      const transformedLists: TaskList[] = lists.map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
        order: l.order,
        createdAt: l.created_at,
      }))

      // Sync to Zustand store
      setTasks(transformedTasks)
      setLists(transformedLists)

      return {
        tasks: transformedTasks,
        lists: transformedLists,
      }
    },
  })
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient()
  const addTask = useTasksStore((s) => s.addTask)

  return useMutation({
    mutationFn: async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      const supabase = getSupabaseBrowserClient()

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            user_id: user.id,
            title: task.title,
            notes: task.notes,
            list_id: task.listId,
            starred: task.starred,
            completed: task.completed,
            deadline: task.deadline,
            order: task.order,
          },
        ])
        .select()
        .single()

      if (error) throw error

      return {
        ...data,
        listId: data.list_id,
        completedAt: data.completed_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        subtasks: [],
      } as Task
    },
    onMutate: async (newTask) => {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const optimisticTask: Task = {
        id,
        ...newTask,
        createdAt: now,
        updatedAt: now,
      }
      addTask(optimisticTask)
      return { optimisticId: id }
    },
    onError: (error, variables, context) => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient()
  const updateTask = useTasksStore((s) => s.updateTask)

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<Task>
    }) => {
      const supabase = getSupabaseBrowserClient()

      const { error } = await supabase
        .from('tasks')
        .update({
          title: updates.title,
          notes: updates.notes,
          list_id: updates.listId,
          starred: updates.starred,
          completed: updates.completed,
          completed_at: updates.completedAt,
          deadline: updates.deadline,
          order: updates.order,
        })
        .eq('id', id)

      if (error) throw error
    },
    onMutate: async ({ id, updates }) => {
      updateTask(id, updates)
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient()
  const deleteTask = useTasksStore((s) => s.deleteTask)

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient()

      const { error } = await supabase.from('tasks').delete().eq('id', id)

      if (error) throw error
    },
    onMutate: async (id) => {
      deleteTask(id)
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

export function useCreateListMutation() {
  const queryClient = useQueryClient()
  const addList = useTasksStore((s) => s.addList)

  return useMutation({
    mutationFn: async (list: Omit<TaskList, 'id' | 'createdAt'>) => {
      const supabase = getSupabaseBrowserClient()

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('task_lists')
        .insert([
          {
            user_id: user.id,
            name: list.name,
            color: list.color,
            order: list.order,
          },
        ])
        .select()
        .single()

      if (error) throw error

      return {
        ...data,
        createdAt: data.created_at,
      } as TaskList
    },
    onMutate: async (newList) => {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const optimisticList: TaskList = {
        id,
        ...newList,
        createdAt: now,
      }
      addList(optimisticList)
      return { optimisticId: id }
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

export function useUpdateListMutation() {
  const queryClient = useQueryClient()
  const updateList = useTasksStore((s) => s.updateList)

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<TaskList>
    }) => {
      const supabase = getSupabaseBrowserClient()

      const { error } = await supabase
        .from('task_lists')
        .update({
          name: updates.name,
          color: updates.color,
          order: updates.order,
        })
        .eq('id', id)

      if (error) throw error
    },
    onMutate: async ({ id, updates }) => {
      updateList(id, updates)
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

export function useDeleteListMutation() {
  const queryClient = useQueryClient()
  const deleteList = useTasksStore((s) => s.deleteList)

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = getSupabaseBrowserClient()

      // Get the inbox list (default list) - assuming it exists
      const { data: inboxList, error: inboxError } = await supabase
        .from('task_lists')
        .select('id')
        .eq('name', 'Inbox')
        .single()

      if (inboxError) throw new Error('Inbox list not found')

      // Reassign all tasks from the deleted list to inbox
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ list_id: inboxList.id })
        .eq('list_id', id)

      if (updateError) throw updateError

      // Delete the list
      const { error: deleteError } = await supabase
        .from('task_lists')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
    },
    onMutate: async (id) => {
      deleteList(id)
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

export function useToggleSubtaskMutation() {
  const queryClient = useQueryClient()
  const toggleSubtask = useTasksStore((s) => s.toggleSubtask)

  return useMutation({
    mutationFn: async ({
      taskId,
      subtaskId,
      completed,
    }: {
      taskId: string
      subtaskId: string
      completed: boolean
    }) => {
      const supabase = getSupabaseBrowserClient()

      const { error } = await supabase
        .from('subtasks')
        .update({ completed })
        .eq('id', subtaskId)

      if (error) throw error
    },
    onMutate: async ({ taskId, subtaskId }) => {
      toggleSubtask(taskId, subtaskId)
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

export function useUpdateSubtaskMutation() {
  const queryClient = useQueryClient()
  const updateSubtask = useTasksStore((s) => s.updateSubtask)

  return useMutation({
    mutationFn: async ({
      subtaskId,
      updates,
    }: {
      taskId: string
      subtaskId: string
      updates: Partial<Subtask>
    }) => {
      const supabase = getSupabaseBrowserClient()

      const { error } = await supabase
        .from('subtasks')
        .update({
          title: updates.title,
          completed: updates.completed,
          notes: updates.notes,
          deadline: updates.deadline,
        })
        .eq('id', subtaskId)

      if (error) throw error
    },
    onMutate: async ({ taskId, subtaskId, updates }) => {
      updateSubtask(taskId, subtaskId, updates)
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

export function useCreateSubtaskMutation() {
  const queryClient = useQueryClient()
  const addSubtask = useTasksStore((s) => s.addSubtask)

  return useMutation({
    mutationFn: async ({
      taskId,
      title,
    }: {
      taskId: string
      title: string
    }) => {
      const supabase = getSupabaseBrowserClient()

      const { data, error } = await supabase
        .from('subtasks')
        .insert([
          {
            task_id: taskId,
            title,
          },
        ])
        .select()
        .single()

      if (error) throw error

      return {
        id: data.id,
        title: data.title,
        completed: data.completed,
      }
    },
    onMutate: async ({ taskId, title }) => {
      const id = crypto.randomUUID()
      const optimisticSubtask: Subtask = { id, title, completed: false }
      addSubtask(taskId, optimisticSubtask)
      return { optimisticId: id }
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

export function useDeleteSubtaskMutation() {
  const queryClient = useQueryClient()
  const deleteSubtask = useTasksStore((s) => s.deleteSubtask)

  return useMutation({
    mutationFn: async ({
      taskId,
      subtaskId,
    }: {
      taskId: string
      subtaskId: string
    }) => {
      const supabase = getSupabaseBrowserClient()

      const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', subtaskId)

      if (error) throw error
    },
    onMutate: async ({ taskId, subtaskId }) => {
      deleteSubtask(taskId, subtaskId)
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}
