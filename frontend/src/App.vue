<template>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <h1>本地数据记录</h1>
        <p>创建折线，记录日期数据，并用多折线图分析趋势。</p>
      </div>
      <div class="top-actions">
        <button class="primary" type="button" :disabled="!lines.length" @click="openPointModal()">
          添加数据
        </button>
        <button type="button" @click="openLineModal()">新增折线</button>
      </div>
    </header>

    <main class="layout">
      <section class="chart-panel">
        <div class="panel-head">
          <div>
            <h2>趋势图</h2>
            <span>{{ visibleLines.length }} 条折线，{{ filteredPoints.length }} 个数据点</span>
          </div>
          <label class="switch">
            <input v-model="showLabels" type="checkbox" />
            <span>数值常显</span>
          </label>
        </div>

        <div v-if="!lines.length" class="empty-state">
          <strong>还没有折线</strong>
          <p>先创建第一条折线，例如体重、学习时长或跑步距离。</p>
          <button class="primary" type="button" @click="openLineModal()">创建折线</button>
        </div>
        <div v-else ref="chartRef" class="chart"></div>
      </section>

      <aside class="side-panel">
        <section class="panel-block">
          <div class="section-title">
            <h2>折线管理</h2>
            <button class="small" type="button" @click="selectAllLines">全选</button>
          </div>

          <div v-if="lines.length" class="line-list">
            <div v-for="line in lines" :key="line.id" class="line-row">
              <label class="line-toggle">
                <input v-model="selectedLineIds" :value="line.id" type="checkbox" />
                <span class="swatch" :style="{ backgroundColor: line.color }"></span>
                <span class="line-name">{{ line.name }}</span>
              </label>
              <div class="row-actions">
                <button class="icon-button" type="button" title="编辑" @click="openLineModal(line)">编辑</button>
                <button class="icon-button danger" type="button" title="删除" @click="removeLine(line)">删除</button>
              </div>
            </div>
          </div>
          <p v-else class="muted">暂无折线。</p>
        </section>

        <section class="panel-block">
          <h2>日期范围</h2>
          <div class="quick-grid">
            <button
              v-for="option in rangeOptions"
              :key="option.key"
              type="button"
              :class="{ active: rangeMode === option.key }"
              @click="setRange(option.key)"
            >
              {{ option.label }}
            </button>
          </div>
          <div v-if="rangeMode === 'custom'" class="date-grid">
            <label>
              开始日期
              <input v-model="customStart" type="date" />
            </label>
            <label>
              结束日期
              <input v-model="customEnd" type="date" />
            </label>
          </div>
        </section>

        <section class="panel-block">
          <h2>导出</h2>
          <div class="button-grid">
            <button type="button" @click="exportData('csv')">CSV</button>
            <button type="button" @click="exportData('excel')">Excel</button>
            <button type="button" @click="exportChart('png')">PNG</button>
            <button type="button" @click="exportChart('jpg')">JPG</button>
            <button type="button" @click="exportChart('svg')">SVG</button>
          </div>
        </section>
      </aside>
    </main>

    <div v-if="lineModal.open" class="modal-backdrop" @click.self="closeLineModal">
      <form class="modal" @submit.prevent="saveLine">
        <h2>{{ lineModal.id ? '编辑折线' : '新增折线' }}</h2>
        <label>
          名称
          <input v-model.trim="lineModal.name" required maxlength="60" placeholder="例如：体重" />
        </label>
        <label>
          颜色
          <input v-model="lineModal.color" type="color" />
        </label>
        <div class="modal-actions">
          <button type="button" @click="closeLineModal">取消</button>
          <button class="primary" type="submit">保存</button>
        </div>
      </form>
    </div>

    <div v-if="pointModal.open" class="modal-backdrop" @click.self="closePointModal">
      <form class="modal" @submit.prevent="savePoint">
        <h2>{{ pointModal.id ? '编辑数据点' : '添加数据' }}</h2>
        <label>
          折线
          <select v-model.number="pointModal.line_id" :disabled="Boolean(pointModal.id)" required>
            <option v-for="line in lines" :key="line.id" :value="line.id">{{ line.name }}</option>
          </select>
        </label>
        <label>
          日期
          <input v-model="pointModal.date" type="date" required />
        </label>
        <label>
          数值
          <input v-model.number="pointModal.value" type="number" step="any" required />
        </label>
        <p v-if="pointModal.id" class="muted">折线名称：{{ lineNameById(pointModal.line_id) }}</p>
        <div class="modal-actions split">
          <button v-if="pointModal.id" class="danger" type="button" @click="removePoint">删除</button>
          <span></span>
          <button type="button" @click="closePointModal">取消</button>
          <button class="primary" type="submit">保存</button>
        </div>
      </form>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import * as echarts from 'echarts'
import {
  buildExportUrl,
  createDataPoint,
  createLine,
  deleteDataPoint,
  deleteLine,
  getDataPoints,
  getLines,
  updateDataPoint,
  updateLine
} from './services/api'
import { subtractDays, todayString } from './utils/date'

const chartRef = ref(null)
let chart = null
let latestChartOption = null

const lines = ref([])
const points = ref([])
const selectedLineIds = ref([])
const showLabels = ref(false)
const rangeMode = ref('all')
const customStart = ref('')
const customEnd = ref('')
const toast = ref('')

const lineModal = reactive({
  open: false,
  id: null,
  name: '',
  color: '#3b82f6'
})

const pointModal = reactive({
  open: false,
  id: null,
  line_id: null,
  date: todayString(),
  value: ''
})

const rangeOptions = [
  { key: 'all', label: '全部' },
  { key: '7', label: '近 7 天' },
  { key: '30', label: '近 30 天' },
  { key: '90', label: '近 90 天' },
  { key: '365', label: '近 1 年' },
  { key: 'custom', label: '自定义' }
]

const rangeDates = computed(() => {
  if (rangeMode.value === 'all') return { startDate: '', endDate: '' }
  if (rangeMode.value === 'custom') {
    return { startDate: customStart.value, endDate: customEnd.value }
  }
  return {
    startDate: subtractDays(Number(rangeMode.value)),
    endDate: todayString()
  }
})

const visibleLines = computed(() => lines.value.filter((line) => selectedLineIds.value.includes(line.id)))

const filteredPoints = computed(() => {
  const { startDate, endDate } = rangeDates.value
  const selected = new Set(selectedLineIds.value)
  return points.value.filter((point) => {
    if (!selected.has(point.line_id)) return false
    if (startDate && point.date < startDate) return false
    if (endDate && point.date > endDate) return false
    return true
  })
})

watch([lines, filteredPoints, showLabels], renderChart, { deep: true })
watch(selectedLineIds, renderChart, { deep: true })
watch(rangeDates, renderChart, { deep: true })

onMounted(async () => {
  await loadAll()
  window.addEventListener('resize', resizeChart)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeChart)
  chart?.dispose()
})

async function loadAll() {
  const [lineData, pointData] = await Promise.all([getLines(), getDataPoints()])
  lines.value = lineData
  points.value = pointData
  selectedLineIds.value = lineData.map((line) => line.id)
  await nextTick()
  initChart()
  renderChart()
}

function initChart() {
  if (!chartRef.value || chart) return
  chart = echarts.init(chartRef.value)
  chart.on('click', (params) => {
    if (params.componentType !== 'series' || !params.data?.pointId) return
    const point = points.value.find((item) => item.id === params.data.pointId)
    if (point) openPointModal(point)
  })
}

function renderChart() {
  nextTick(() => {
    initChart()
    if (!chart) return

    const series = visibleLines.value.map((line) => {
      const data = filteredPoints.value
        .filter((point) => point.line_id === line.id)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((point) => ({
          name: point.date,
          value: [point.date, point.value],
          pointId: point.id
        }))

      return {
        name: line.name,
        type: 'line',
        data,
        connectNulls: true,
        showSymbol: true,
        symbolSize: 8,
        lineStyle: { width: 3, color: line.color },
        itemStyle: { color: line.color },
        label: {
          show: showLabels.value,
          formatter: ({ value }) => value?.[1],
          position: 'top'
        },
        markPoint: {
          symbolSize: 56,
          label: { formatter: '{b}' },
          data: data.length
            ? [
                { type: 'max', name: '最大值' },
                { type: 'min', name: '最小值' }
              ]
            : []
        }
      }
    })

    latestChartOption = {
        color: visibleLines.value.map((line) => line.color),
        tooltip: {
          trigger: showLabels.value ? 'none' : 'item',
          formatter: (params) => {
            const value = params.value || []
            return `${params.seriesName}<br/>日期：${value[0]}<br/>数值：${value[1]}`
          }
        },
        legend: { top: 0, type: 'scroll' },
        grid: { left: 52, right: 28, top: 52, bottom: 82 },
        xAxis: {
          type: 'time',
          axisLabel: { formatter: '{yyyy}-{MM}-{dd}' }
        },
        yAxis: {
          type: 'value',
          scale: true
        },
        dataZoom: [
          { type: 'inside', xAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: true, moveOnMouseMove: true },
          { type: 'slider', xAxisIndex: 0, height: 28, bottom: 24, filterMode: 'none' }
        ],
        series
      }

    chart.setOption(latestChartOption, true)
    chart.resize()
  })
}

function resizeChart() {
  chart?.resize()
}

function openLineModal(line = null) {
  lineModal.open = true
  lineModal.id = line?.id || null
  lineModal.name = line?.name || ''
  lineModal.color = line?.color || randomColor()
}

function closeLineModal() {
  lineModal.open = false
}

async function saveLine() {
  const payload = { name: lineModal.name, color: lineModal.color }
  if (lineModal.id) {
    const updated = await updateLine(lineModal.id, payload)
    lines.value = lines.value.map((line) => (line.id === updated.id ? updated : line))
    notify('折线已更新')
  } else {
    const created = await createLine(payload)
    lines.value.push(created)
    selectedLineIds.value.push(created.id)
    notify('折线已创建')
  }
  closeLineModal()
}

async function removeLine(line) {
  const confirmed = window.confirm('确定删除该折线及其所有历史数据吗？')
  if (!confirmed) return
  await deleteLine(line.id)
  lines.value = lines.value.filter((item) => item.id !== line.id)
  points.value = points.value.filter((item) => item.line_id !== line.id)
  selectedLineIds.value = selectedLineIds.value.filter((id) => id !== line.id)
  notify('折线已删除')
}

function openPointModal(point = null) {
  if (!lines.value.length) {
    notify('请先创建折线')
    return
  }
  pointModal.open = true
  pointModal.id = point?.id || null
  pointModal.line_id = point?.line_id || selectedLineIds.value[0] || lines.value[0].id
  pointModal.date = point?.date || todayString()
  pointModal.value = point?.value ?? ''
}

function closePointModal() {
  pointModal.open = false
}

async function savePoint(overwrite = false) {
  const payload = {
    line_id: pointModal.line_id,
    date: pointModal.date,
    value: pointModal.value,
    overwrite
  }
  try {
    const saved = pointModal.id
      ? await updateDataPoint(pointModal.id, payload)
      : await createDataPoint(payload)
    upsertPoint(saved)
    closePointModal()
    notify('数据点已保存')
  } catch (error) {
    if (error.status === 409 && error.data?.code === 'duplicate_data_point') {
      const confirmed = window.confirm('同一条折线在该日期已有数据，是否覆盖？')
      if (confirmed) await savePoint(true)
      return
    }
    notify(error.message)
  }
}

async function removePoint() {
  const confirmed = window.confirm('确定删除该数据点吗？')
  if (!confirmed) return
  await deleteDataPoint(pointModal.id)
  points.value = points.value.filter((point) => point.id !== pointModal.id)
  closePointModal()
  notify('数据点已删除')
}

function upsertPoint(saved) {
  points.value = points.value.filter((point) => point.id !== saved.id)
  const sameLineDateIndex = points.value.findIndex(
    (point) => point.line_id === saved.line_id && point.date === saved.date
  )
  if (sameLineDateIndex >= 0) points.value.splice(sameLineDateIndex, 1)
  points.value.push(saved)
}

function selectAllLines() {
  selectedLineIds.value = lines.value.map((line) => line.id)
}

function setRange(key) {
  rangeMode.value = key
  if (key === 'custom' && !customEnd.value) customEnd.value = todayString()
}

function exportData(format) {
  const url = buildExportUrl(format, {
    lineIds: selectedLineIds.value,
    ...rangeDates.value
  })
  window.location.href = url
}

function exportChart(format) {
  if (!chart || !latestChartOption) return
  if (format === 'svg') {
    const box = chartRef.value.getBoundingClientRect()
    const temp = document.createElement('div')
    temp.style.width = `${Math.max(box.width, 900)}px`
    temp.style.height = `${Math.max(box.height, 560)}px`
    temp.style.position = 'fixed'
    temp.style.left = '-10000px'
    document.body.appendChild(temp)
    const svgChart = echarts.init(temp, null, { renderer: 'svg' })
    svgChart.setOption(latestChartOption, true)
    const svgUrl = svgChart.getDataURL({ type: 'svg', backgroundColor: '#ffffff' })
    downloadUrl(svgUrl, 'chart.svg')
    svgChart.dispose()
    temp.remove()
    return
  }

  const type = format === 'jpg' ? 'jpeg' : format
  const url = chart.getDataURL({
    type,
    pixelRatio: 2,
    backgroundColor: '#ffffff'
  })
  downloadUrl(url, `chart.${format}`)
}

function downloadUrl(url, filename) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
}

function lineNameById(id) {
  return lines.value.find((line) => line.id === id)?.name || ''
}

function randomColor() {
  const colors = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#be123c']
  return colors[lines.value.length % colors.length]
}

function notify(message) {
  toast.value = message
  window.clearTimeout(notify.timer)
  notify.timer = window.setTimeout(() => {
    toast.value = ''
  }, 2200)
}
</script>
