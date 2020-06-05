const {round, max, min} = Math;

const tap = (fn) => (x) => 
  (fn (x), x)

const pluck = (name) => (xs) => 
  xs .map (x => x[name])

const uniq = (xs) => 
  [...new Set(xs)]

const diffs = (xs) => xs .map ((x, i) => i > 0 ? x - xs [i - 1] : x)

const sum = (ns) =>
  ns .reduce ((a, b) => a + b, 0)

const avg = (ns) =>
  sum (ns) / ns .length

const nDayAvg = (n) => (xs) => 
  xs .map ((_, i) => round (avg (xs .slice (max (i - n, 0), i + 1))))
  
const groupBy = (fn) => (xs) => xs .reduce ((a, x) => ({
  ...a, 
  [fn(x)] : [...(a[fn(x)] || []), x]
}), {})
  
const config = ({state}) => ({
  row1: {
    dailyDeaths: {
      meta: {title: `${ state } COVID-19 deaths by date`},
      fn: (days) => [{
        x: pluck ('date') (days),
        y: diffs (pluck ('deaths') (days)),
        type: 'area', 
        fill: 'tonexty',
        name: 'Covid deaths',
      },{
        x: days .map (({date}) => date),
        y: nDayAvg (7) (diffs (days .map (({deaths}) => deaths))),
        type: 'area', 
        name: '7-day average',
        fill: 'tozeroy',
    }] 
    },
    dailyCases: {
      meta: {title: `${ state } COVID-19 cases by date`},
      fn: (days) => [{
        x: days .map (({date}) => date),
        y: diffs (days .map (({cases}) => cases)),
        type: 'area', 
        fill: 'tonexty',
        name: 'Covid cases',
      },{
        x: days .map (({date}) => date),
        y: nDayAvg (7) (diffs (days .map (({cases}) => cases))),
        type: 'area', 
        name: '7-day average',
        fill: 'tozeroy',
      }]
    },
  }, 
  row2: {
    totalDeaths: {
      meta: {title: `${ state } COVID-19 total deaths`},
      fn: (days) => [{
        x: days .map (({date}) => date),
        y: days .map (({deaths}) => deaths),
        type: 'area', 
        fill: 'tonexty',
        name: 'Covid deaths',
      }] 
    },
    totalCases: {
      meta: {title: `${ state } COVID-19 total cases`},
      fn: (days) => [{
        x: days .map (({date}) => date),
        y: days .map (({cases}) => cases),
        type: 'area', 
        fill: 'tonexty',
        name: 'Covid cases',
      }] 
    },
  }
})

const csv2arr = (csv) => {
  const [headers, ...rows] = csv .trim () .split ('\n') .map (r => r .split (','))
  return rows .reduce ((a, r) => [
    ... a, 
    Object .assign (... (r .map ((c, i) => ({[headers [i]]: isNaN (c) ? c : Number (c)}))))
  ], [])
}

const addUnitedStates = (days) => [
  ... days, 
  ... Object.values(groupBy(x => x.date)(days))
        .map(d => d.reduce(
          ({state, cases, deaths}, {date, cases: c, deaths: d}) => ({date, state, cases: cases + c, deaths: deaths + d}), 
          {state: 'United States', cases: 0, deaths: 0}
        ))
]

const makeTable = ({state, days}) => {
  const xs = days .map (({date, deaths, cases}, i) => ({
    Date: `${Number (date .slice (5, 7))}/${Number (date .slice (8, 10))}/${date .slice (0, 4)}`,
    Cases: (i == 0 ? cases : cases - days [i - 1] .cases),
    'Total Cases': cases,
    Deaths: (i == 0 ? deaths : deaths - days [i - 1] .deaths),
    'Total Deaths': deaths,
  }))
  const keys = Object .keys (xs [0] || {});
  const raw = document .getElementById ('raw')
  raw .innerHTML = 
  `<details id="raw-details">
    <summary>${state} Raw Data</summary>
    <table>
      <thead>
        <tr>${ keys .map (name => `<th>${ name }</th>`) .join ('') }</tr>
      </thead>
      <tbody>
        ${ xs .map ((x, i) => `<tr>${ keys .map (k => `<td>${x [k] }</td>`).join('') }</tr>`).join('\n  ') }
      </tbody>
    </table>
  </details>
`
  document .getElementById ('raw-details') .open = true
}

const makeSparkline = (allDays) => {
  // TODO: use some normalization based on allDays, so sparklines are comparable.
  // But perhaps not as well.  And if not, a better factoring would move the data generation out, leaving only the `.map` call 
  return (type, width, height, color = '#0074d9') => (state) => {
    const values = nDayAvg (7) (pluck (type) (allDays.filter(({state: s}) => state == s)).map ((x, i, a) => x - (i == 0 ? 0 : a[i - 1])))
    const lo = min (...values)
    const hi = max (...values)
    const count = values .length
    const pairs = values .map ((v, i) => [
      i / count * width,
      height - (v - lo) / (hi - lo) * height
    ].join(',')).join(' ')

    return `<svg viewBox="0 0 ${width} ${height}" class="chart" style="height:${height}px; width:${width}px">
    <polyline
       fill="none"
       stroke="${color}"
       stroke-width="1"
       points="${pairs}"/>
  </svg>`
  }
}

const addNational = (allDays) => {
  const states = 
    Object .entries (groupBy (s => s.state) (allDays)) .map (([state, days]) => [state, {
      cases: {
        total: days .slice (-1) [0] .cases,
        oneDay: days .slice (-1) [0] .cases - days .slice (-2, -1) [0] .cases,
        sevenDays: days.slice (-1) [0] .cases - days .slice (-8, -7) [0] .cases,
        thirtyDays: days.slice (-1) [0] .cases - days .slice (-31, -1) [0] .cases,
      },
      deaths: {
        total: days .slice (-1) [0] .deaths,
        oneDay: days .slice (-1) [0] .deaths - days .slice (-2, -1) [0] .deaths,
        sevenDays: days.slice (-1) [0] .deaths - days .slice (-8, -7) [0] .deaths,
        thirtyDays: days.slice (-1) [0] .deaths - days .slice (-31, -1) [0] .deaths,
      }
    }]) .sort (([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  const idx = states .findIndex(([s]) => s == "United States")
  const totals = states [idx] [1];
  const byState = [...states .slice (0, idx), ... states .slice (idx +1)]
  const national = document .getElementById ('national')
  const casesSparkline = makeSparkline (allDays) ('cases', 100, 30)
  const deathsSparkline = makeSparkline (allDays) ('deaths', 100, 30)
  national.innerHTML = `
  <table>
  <thead>
  <tr><th></th><th colspan="5">Cases</th><th colspan="5">Deaths</th></tr>
  <tr><th></th><th colspan="3">in previous...</th><th colspan="2"></th><th colspan="3">in previous...</th><th colspan="2"></th></tr>
  <tr>
    <th>State</th>
    <th>Day</th><th>Week</th><th>Month</th><th>Total</th><th>Trend</th>
    <th>Day</th><th>Week</th><th>Month</th><th>Total</th><th>Trend</th>
  </tr>
  </thead>
    <tbody>
      ${byState.map(([state, {cases, deaths}]) =>
      `<tr>
        <td><a href="#/${ state .replace(/ /g, '+') }">${ state }</a></td>
        <td>${cases.oneDay}</td><td>${cases.sevenDays}</td><td>${cases.thirtyDays}</td><td>${cases.total}</td><td>${casesSparkline (state)}</td>
        <td>${deaths.oneDay}</td><td>${deaths.sevenDays}</td><td>${deaths.thirtyDays}</td><td>${deaths.total}</td><td>${deathsSparkline (state)}</td>
      </tr>`).join('\n      ')}
    </tbody>
    <tfoot>
      <tr>
        <th><a href="#/United+States">United States</a></th>
        <th>${totals.cases.oneDay}</th><th>${totals.cases.sevenDays}</th><th>${totals.cases.thirtyDays}</th><th>${totals.cases.total}</th><th>${makeSparkline (allDays) ('cases', 100, 30, 'white') ('United States')}</th>
        <th>${totals.deaths.oneDay}</th><th>${totals.deaths.sevenDays}</th><th>${totals.deaths.thirtyDays}</th><th>${totals.deaths.total}</th><th>${makeSparkline (allDays) ('deaths', 100, 30, 'white') ('United States')}</th>
      </tr>
    </tfoot>
  </table>`
}

const makeCharts = ({state, days}) => {
  const chartDiv = document .getElementById ('charts')
  chartDiv.innerHTML = ''
  Object .entries (config ({state, days})) .forEach (([_, row]) => 
    Object.entries (row).forEach(([id, {meta, fn}]) => {
      const div = document .createElement ('DIV')
      div.id = id
      chartDiv .appendChild (div)
      Plotly .newPlot (id, fn(days), meta, {responsive: true}) 
    })
  )
}

const stateChooser = (days) => {
  const states = uniq (pluck ('state') (days)) .sort()
  const details =  document .getElementById ('chooser')
  const national = document .getElementById ('show-national')
  details .open = true
  const stateList = document .getElementById ('states')
  stateList .innerHTML = `<li><a href="#/United+States">United States</a></li><hr/>${
    states .filter (s => s !== "United States") .map (state => `<li><a href="#/${ state .replace(/ /g, '+') }">${ state }</a></li>`).join('')
  }`
  const chooseState = () => {
    const state = unescape((document .location .hash || '') .replace(/\+/g, ' ')).slice(2)
    if (states .includes (state)) {
       document .title = `Covid Information for ${ state }`
       document .getElementById ('title') .innerHTML = `${ state } Covid Charts`
       const stateData = days .filter (s => s .state == state)
       makeTable ({state, days: stateData})
       makeCharts ({state, days: stateData})
       details .open = false
       national .open = false
    } else {
       document .title = `Covid Information`
       document .getElementById ('title') .innerHTML = `State Covid charts`
       details .open = true
       document.getElementById('charts').innerHTML = ''
       document.getElementById('raw').innerHTML = ''
    }
  }

  window.addEventListener('popstate', chooseState);
  chooseState()
}

const displayError = (err) =>
  document .getElementById ('title') .innerHTML = `Problem loading data: ${err}`

fetch ('https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-states.csv')
  .then (r => r .text ())
  .then (csv2arr)
  .then (addUnitedStates)
  .then (tap (addNational))
  .then (tap (stateChooser))
  .catch (displayError)
