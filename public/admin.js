/* Admin panel — Vue 3 (global build). Auth is handled by the browser's
   Basic Auth credentials, sent automatically on same-origin requests. */
const { createApp, ref, reactive, onMounted } = Vue;

createApp({
  setup() {
    const tabs = ['resources', 'groups', 'news', 'account'];
    const tab = ref('resources');
    const isDark = ref(document.documentElement.classList.contains('dark'));

    const resources = ref([]);
    const groups = ref([]);
    const news = ref([]);
    const account = reactive({ username: '', password: '' });
    const intervals = ref([5, 15]); // overwritten by /admin/api/meta

    const resForm = reactive({ name: '', endpoint: '', intervalMinutes: 5, groupId: '' });
    const groupForm = reactive({ name: '' });
    const newsForm = reactive({ title: '', body: '', level: 'info' });

    const toast = ref(null);
    let toastTimer = null;
    function notify(msg, ok = true) {
      toast.value = { msg, ok };
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (toast.value = null), 3500);
    }

    const inputCls =
      'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-slate-700';

    function newsBadge(level) {
      return {
        info: 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300',
        warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
        critical: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
      }[level];
    }

    async function api(method, url, body) {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 204) return null;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      return data;
    }

    async function loadMeta() {
      const m = await api('GET', '/admin/api/meta');
      intervals.value = m.allowedIntervals || intervals.value;
      resForm.intervalMinutes = intervals.value[0];
    }
    async function loadResources() {
      resources.value = await api('GET', '/admin/api/resources');
    }
    async function loadGroups() {
      groups.value = await api('GET', '/admin/api/groups');
    }
    async function loadNews() {
      news.value = await api('GET', '/admin/api/news');
    }
    async function loadAccount() {
      const a = await api('GET', '/admin/api/account');
      account.username = a.username || '';
    }

    function groupName(id) {
      const g = groups.value.find((x) => x.id === id);
      return g ? g.name : 'Ungrouped';
    }

    async function addResource() {
      try {
        await api('POST', '/admin/api/resources', { ...resForm });
        resForm.name = '';
        resForm.endpoint = '';
        resForm.intervalMinutes = intervals.value[0];
        resForm.groupId = '';
        await loadResources();
        notify('Service added.');
      } catch (e) {
        notify(e.message, false);
      }
    }
    async function saveResource(r) {
      try {
        await api('PUT', `/admin/api/resources/${r.id}`, {
          name: r.name,
          endpoint: r.endpoint,
          intervalMinutes: r.interval_minutes,
          enabled: r.enabled === 1,
          groupId: r.group_id === null ? null : r.group_id,
        });
        notify('Saved.');
      } catch (e) {
        notify(e.message, false);
      }
    }

    async function addGroup() {
      try {
        await api('POST', '/admin/api/groups', { name: groupForm.name });
        groupForm.name = '';
        await loadGroups();
        notify('Group added.');
      } catch (e) {
        notify(e.message, false);
      }
    }
    async function renameGroup(g) {
      try {
        await api('PUT', `/admin/api/groups/${g.id}`, { name: g.name });
        notify('Group renamed.');
      } catch (e) {
        notify(e.message, false);
      }
    }
    async function deleteGroup(g) {
      if (!confirm(`Delete group "${g.name}"? Its services become ungrouped.`)) return;
      try {
        await api('DELETE', `/admin/api/groups/${g.id}`);
        await Promise.all([loadGroups(), loadResources()]);
        notify('Group deleted.');
      } catch (e) {
        notify(e.message, false);
      }
    }
    async function moveGroup(index, delta) {
      const next = index + delta;
      if (next < 0 || next >= groups.value.length) return;
      const ordered = [...groups.value];
      [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
      groups.value = ordered;
      try {
        await api('POST', '/admin/api/groups/reorder', { ids: ordered.map((g) => g.id) });
      } catch (e) {
        notify(e.message, false);
        await loadGroups();
      }
    }
    async function deleteResource(r) {
      if (!confirm(`Delete "${r.name}"? Its history will be removed.`)) return;
      try {
        await api('DELETE', `/admin/api/resources/${r.id}`);
        await loadResources();
        notify('Deleted.');
      } catch (e) {
        notify(e.message, false);
      }
    }
    async function checkResource(r) {
      try {
        await api('POST', `/admin/api/resources/${r.id}/check`);
        notify(`Checked "${r.name}".`);
      } catch (e) {
        notify(e.message, false);
      }
    }

    async function addNews() {
      try {
        await api('POST', '/admin/api/news', { ...newsForm });
        newsForm.title = '';
        newsForm.body = '';
        newsForm.level = 'info';
        await loadNews();
        notify('Announcement published.');
      } catch (e) {
        notify(e.message, false);
      }
    }
    async function toggleNews(n) {
      try {
        await api('PUT', `/admin/api/news/${n.id}`, { active: !n.active });
        await loadNews();
      } catch (e) {
        notify(e.message, false);
      }
    }
    async function deleteNews(n) {
      if (!confirm('Delete this announcement?')) return;
      try {
        await api('DELETE', `/admin/api/news/${n.id}`);
        await loadNews();
        notify('Deleted.');
      } catch (e) {
        notify(e.message, false);
      }
    }

    async function saveAccount() {
      try {
        await api('PUT', '/admin/api/account', {
          username: account.username,
          password: account.password,
        });
        notify('Credentials updated. Reloading to re-authenticate…');
        account.password = '';
        // The old Basic Auth credentials are now invalid; reload to prompt again.
        setTimeout(() => location.reload(), 1500);
      } catch (e) {
        notify(e.message, false);
      }
    }

    function toggleTheme() {
      isDark.value = !isDark.value;
      document.documentElement.classList.toggle('dark', isDark.value);
      localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
    }

    onMounted(async () => {
      try {
        await Promise.all([
          loadMeta(),
          loadResources(),
          loadGroups(),
          loadNews(),
          loadAccount(),
        ]);
      } catch (e) {
        notify(e.message, false);
      }
    });

    return {
      tabs,
      tab,
      isDark,
      resources,
      groups,
      news,
      account,
      intervals,
      resForm,
      groupForm,
      newsForm,
      toast,
      inputCls,
      newsBadge,
      groupName,
      addResource,
      saveResource,
      deleteResource,
      checkResource,
      addGroup,
      renameGroup,
      deleteGroup,
      moveGroup,
      addNews,
      toggleNews,
      deleteNews,
      saveAccount,
      toggleTheme,
    };
  },
}).mount('#app');
