const {round, max} = Math;

const tap = (fn) => (x) => 
  (fn (x), x)

const pluck = (name) => (xs) => 
  xs .map (x => x[name])

const uniq = (xs) => 
  [...new Set(xs)]

const diffs = (xs) => xs .slice (1) .map ((x, i) => i > 0 ? x - xs [i - 1] : x)

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
})

const csv2arr = (csv) => {
  const [headers, ...rows] = csv .trim () .split ('\n') .map (r => r .split (','))
  return rows .reduce ((a, r) => [
    ... a, 
    Object .assign (... (r .map ((c, i) => ({[headers [i]]: isNaN (c) ? c : Number (c)}))))
  ], [])
}

const addNational = (days) => [
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
  raw.innerHTML = 
  `<details id="raw-details">
    <summary>${state} Raw Data</summary>
    <table>
      <thead>
        <tr>${ keys .map (name => `<th>${ name }</th>`) .join ('') }</tr>
      </thead>
      <tbody>
        ${ xs .map ((x, i) => `<tr class="${ i % 2 ? 'odd' : 'even'}">${ keys .map (k => `<td>${x [k] }</td>`).join('') }</tr>`).join('\n  ') }
      </tbody>
    </table>
  </details>
`
  document .getElementById ('raw-details') .open = true
}

const makeCharts = ({state, days}) => {
  const chartDiv = document .getElementById ('charts')
  chartDiv.innerHTML = ''
  Object .entries (config ({state, days})) .forEach (([id, {meta, fn}]) => {
    const div = document .createElement ('DIV')
    div.id = id
    chartDiv .appendChild (div)
    Plotly .newPlot (id, fn(days), meta, {responsive: true}) 
  })
}

const stateChooser = (days) => {
  const states = uniq (pluck ('state') (days)) .sort()
  const details =  document .getElementById ('chooser')
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
    } else {
       document .title = `Covid Information`
       document .getElementById ('title') .innerHTML = `State Covid charts`
    }
  }

  window.addEventListener('popstate', chooseState);
  chooseState()
}

const displayError = (err) =>
  document .getElementById ('title') .innerHTML = `Problem loading data`

fetch ('https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-states.csv')
  .then (r => r .text ())
  .then (csv2arr)
  .then (addNational)
  .then (tap (stateChooser))
  .catch (displayError)
