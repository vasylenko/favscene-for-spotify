import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import CallbackView from '@/views/CallbackView.vue'
import SceneWizardView from '@/views/SceneWizardView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/callback',
      name: 'callback',
      component: CallbackView,
    },
    {
      path: '/create',
      name: 'create-scene',
      component: SceneWizardView,
    },
    {
      path: '/edit/:id',
      name: 'edit-scene',
      component: SceneWizardView,
    },
  ],
})

export default router
