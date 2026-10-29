import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';

import App from './App.vue';
import CatalogView from './features/catalog/CatalogView.vue';
import CoursesView from './features/courses/CoursesView.vue';
import PracticeView from './features/practice/PracticeView.vue';
import RecallView from './features/recall/RecallView.vue';

import './style.css';


/**
 * 应用路由管理器。
 * @type {import('vue-router').Router}
 */
const router = createRouter({ history: createWebHashHistory(), routes: [
  { path: '/', redirect: '/map' },
  { path: '/map', name: 'map', component: CoursesView },
  { path: '/practice/:id?', name: 'practice', component: PracticeView },
  { path: '/library', name: 'library', component: CatalogView },
  { path: '/recall', name: 'recall', component: RecallView },
  { path: '/:pathMatch(.*)*', redirect: '/map' },
] });
/**
 * Vue 应用实例。
 * @type {import('vue').App}
 */
const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
