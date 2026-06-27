/* Public status page — Vue 3 (global build), no build step. */
const { createApp, ref, computed, onMounted, onUnmounted } = Vue;

createApp({
  setup() {
    const data = ref(null);
    const loading = ref(true);
    const isDark = ref(document.documentElement.classList.contains('dark'));
    let timer = null;

    // Header link target: a `?back=<uri>` query param if present (and a safe
    // http(s) URL), otherwise the default Wenex site.
    const backUrl = computed(() => {
      const raw = new URLSearchParams(location.search).get('back');
      if (raw && /^https?:\/\//i.test(raw)) return raw;
      return 'https://wenex.org';
    });

    const overall = computed(() => (data.value ? data.value.overall : 'unknown'));

    // Ungrouped resources (group id === null) are shown first, header-less.
    const ungrouped = computed(() =>
      data.value ? (data.value.groups.find((g) => g.id === null) ?? null) : null,
    );
    // There is only ever a single ungrouped service — render it as one full box.
    const ungroupedItem = computed(() => ungrouped.value?.resources[0] ?? null);
    // Every other (named) group keeps its title + aggregate bullet, rendered compact.
    const namedGroups = computed(() =>
      data.value ? data.value.groups.filter((g) => g.id !== null) : [],
    );

    const overallLabel = computed(
      () =>
        ({
          operational: 'All systems operational',
          degraded: 'Partial outage',
          down: 'Major outage',
          unknown: 'Status unknown',
        })[overall.value],
    );

    const overallClasses = computed(() => {
      switch (overall.value) {
        case 'operational':
          return {
            box: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40',
            dot: 'bg-emerald-500',
            ping: 'bg-emerald-400',
            text: 'text-emerald-700 dark:text-emerald-300',
          };
        case 'degraded':
          return {
            box: 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40',
            dot: 'bg-amber-500',
            ping: 'bg-amber-400',
            text: 'text-amber-700 dark:text-amber-300',
          };
        case 'down':
          return {
            box: 'border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40',
            dot: 'bg-rose-500',
            ping: 'bg-rose-400',
            text: 'text-rose-700 dark:text-rose-300',
          };
        default:
          return {
            box: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
            dot: 'bg-slate-400',
            ping: 'bg-slate-300',
            text: 'text-slate-600 dark:text-slate-300',
          };
      }
    });

    function dotClass(state) {
      return {
        up: 'bg-emerald-500',
        down: 'bg-rose-500',
        unknown: 'bg-slate-300 dark:bg-slate-600',
      }[state];
    }
    function textClass(state) {
      return {
        up: 'text-emerald-600 dark:text-emerald-400',
        down: 'text-rose-600 dark:text-rose-400',
        unknown: 'text-slate-400',
      }[state];
    }
    function stateLabel(state) {
      return { up: 'Operational', down: 'Down', unknown: 'Unknown' }[state];
    }

    // Aggregate (group / overall) status presentation.
    function aggLabel(s) {
      return {
        operational: 'Operational',
        degraded: 'Degraded',
        down: 'Down',
        unknown: 'No data',
      }[s];
    }
    function aggDot(s) {
      return {
        operational: 'bg-emerald-500',
        degraded: 'bg-amber-500',
        down: 'bg-rose-500',
        unknown: 'bg-slate-300 dark:bg-slate-600',
      }[s];
    }
    function aggText(s) {
      return {
        operational: 'text-emerald-600 dark:text-emerald-400',
        degraded: 'text-amber-600 dark:text-amber-400',
        down: 'text-rose-600 dark:text-rose-400',
        unknown: 'text-slate-400',
      }[s];
    }

    function newsClasses(level) {
      return {
        info: 'border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/30',
        warning:
          'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30',
        critical:
          'border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30',
      }[level];
    }
    function newsBadge(level) {
      return {
        info: 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300',
        warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
        critical: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300',
      }[level];
    }

    // Human-friendly monitoring cadence, shown in place of the internal endpoint.
    function checkCadence(r) {
      const m = r.intervalMinutes;
      if (!m || m <= 0) return 'Monitored continuously';
      if (m < 60) return `Checked every ${m} min`;
      const h = m / 60;
      if (Number.isInteger(h)) return `Checked every ${h} ${h === 1 ? 'hour' : 'hours'}`;
      return `Checked every ${m} min`;
    }

    function formatDate(iso) {
      const d = new Date(iso.includes('Z') || iso.includes('T') ? iso : iso + 'Z');
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    function relativeTime(iso) {
      const d = new Date(iso.includes('Z') || iso.includes('T') ? iso : iso + 'Z');
      const diff = Math.round((Date.now() - d.getTime()) / 1000);
      if (diff < 60) return 'just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    }

    async function load() {
      try {
        const res = await fetch('/api/status');
        data.value = await res.json();
      } catch (e) {
        console.error('Failed to load status', e);
      } finally {
        loading.value = false;
      }
    }

    function toggleTheme() {
      isDark.value = !isDark.value;
      document.documentElement.classList.toggle('dark', isDark.value);
      localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
    }

    onMounted(() => {
      load();
      timer = setInterval(load, 30_000);
    });
    onUnmounted(() => clearInterval(timer));

    return {
      data,
      loading,
      isDark,
      backUrl,
      ungrouped,
      ungroupedItem,
      namedGroups,
      overall,
      overallLabel,
      overallClasses,
      dotClass,
      textClass,
      stateLabel,
      aggLabel,
      aggDot,
      aggText,
      newsClasses,
      newsBadge,
      checkCadence,
      formatDate,
      relativeTime,
      toggleTheme,
    };
  },
}).mount('#app');
