const {round, max, min} = Math;

const tap = (fn) => (x) => 
  (fn (x), x)

const pluck = (name) => (xs) => 
  xs .map (x => x[name])

const uniq = (xs) => 
  [...new Set(xs)]

const diffs = (xs) => 
  xs .map ((x, i) => i > 0 ? x - xs [i - 1] : x)

const sum = (ns) =>
  ns .reduce ((a, b) => a + b, 0)

const avg = (ns) =>
  sum (ns) / ns .length

const reverse = (xs) =>
  xs .slice (0) .reverse ()

const addCommas = (n) =>
  [...String(n)] .reverse () .flatMap (
    (d, i, a) => i % 3 == 2 && i < a.length - 1 ? [d, ','] : [d]
  ) .reverse () .join ('')

const nDayAvg = (n) => (xs) => 
  xs .map ((_, i) => round (avg (xs .slice (max (i - n, 0), i + 1))))
  
const groupBy = (fn) => (xs) => xs .reduce ((a, x) => ({
  ...a, 
  [fn(x)] : [...(a[fn(x)] || []), x]
}), {})

const path = (ps) => (obj) =>
  ps .reduce ((o, p) => (o || {}) [p], obj)

const getPath = (pathStr) => 
  path(pathStr .split ('.'))

const call = (fn,...args) =>
  fn (...args)

const plainSort = (path, ascend) => (a, b) => call((
    aa = getPath(path)(a),
    bb = getPath(path)(b)
  ) => aa < bb ? ascend ? -1 : 1 : aa > bb ? ascend ? 1 : -1 : 0
)

const sortType = {
  alpha: plainSort,
  numeric: plainSort,
  // Sort by the ratio of the most recent to the maximum, with a secondary of
  // ratio of most recent to average.  It's ad hoc but results seems reasonable.
  trend: (path, ascend) => (a, b) => {
    const as = getPath(path)(a);
    const al = as[as.length - 1]
    const am = Math.max(...as)
    const aa = al / ((Math.max(am, 1)) || 1)
    const av = al / ((avg(as)) || 1)
    const bs = getPath(path)(b);
    const bl = bs[bs.length - 1]
    const bm = Math.max(...bs)
    const bb = bl / ((Math.max(bm, 1)) || 1)
    const bv = bl / ((avg(bs)) || 1)
    return aa < bb ? ascend ? -1 : 1 : aa > bb ? ascend ? 1 : -1 : 
           av < bv ? ascend ? -1 : 1 : av > bb ? ascend ? 1 : -1 : 0
  }
}

  
const config = ({state}) => ({
  row1: {
    dailyDeaths: {
      meta: {title: `${ state } COVID-19 deaths by date`},
      fn: (days) => [{
        x: pluck ('date') (days),
        y: diffs (pluck ('deaths') (days)),
        type: 'bar', 
        name: 'Covid deaths',
      },{
        x: days .map (({date}) => date),
        y: nDayAvg (7) (diffs (days .map (({deaths}) => deaths))),
        type: 'line', 
        name: '7-day average',
        fill: 'tozeroy',
    }] 
    },
    dailyCases: {
      meta: {title: `${ state } COVID-19 cases by date`},
      fn: (days) => [{
        x: days .map (({date}) => date),
        y: diffs (days .map (({cases}) => cases)),
        type: 'bar', 
        name: 'Covid cases',
      },{
        x: days .map (({date}) => date),
        y: nDayAvg (7) (diffs (days .map (({cases}) => cases))),
        type: 'line', 
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

const makeSparkline = (width, height, color = '#0074d9') => (values) => {
  const lo = min (...values)
  const hi = max (...values)
  const count = (values .length || 1)
  const pairs = values .map ((v, i) => [
    i / count * width,
    height - (v - lo) / ((hi - lo) || 1) * height
  ].join(',')).join(' ')

  return `<svg viewBox="0 0 ${width} ${height}" class="chart" style="height:${height}px; width:${width}px">
  <polyline
      fill="none"
      stroke="${color}"
      stroke-width="1"
      points="${pairs}"/>
</svg>`
}

const addNational = (populations, allDays, {totals, byState, path, direction}) => {
  const national = document .getElementById ('national')
  const sparkline = makeSparkline (100, 30)
  const footerSparkline = makeSparkline (100, 30, 'white')
  national.innerHTML = `
  <table>
  <thead>
  <tr><th rowspan="3" data-sort="state:alpha">State</th><th colspan="6">Cases</th><th colspan="6">Deaths</th></tr>
  <tr><th colspan="3">in previous...</th><th data-sort="cases.total:numeric" rowspan="2">Total</th><th data-sort="cases.per100k:numeric" rowspan="2">Per 100K</th><th rowspan="2" data-sort="cases.trend:trend">Trend</th><th colspan="3">in previous...</th><th data-sort="deaths.total:numeric" rowspan="2">Total</th><th data-sort="deaths.per100k:numeric" rowspan="2">Per 100K</th><th rowspan="2" data-sort="cases.trend:trend">Trend</th></tr>
  <tr>
    <th data-sort="cases.oneDay:numeric">Day</th> <th data-sort="cases.sevenDays:numeric">Week</th> <th data-sort="cases.thirtyDays:numeric">Month</th>
    <th data-sort="deaths.oneDay:numeric">Day</th><th data-sort="deaths.sevenDays:numeric">Week</th><th data-sort="deaths.thirtyDays:numeric">Month</th>
  </tr>
  </thead>
    <tbody>
      ${byState.map(({state, cases, deaths}) =>
      `<tr>
        <td title="Population: ${addCommas(populations[state])}"><a href="#/${ state .replace(/ /g, '+') }">${ state }</a></td>
        <td>${cases.oneDay}</td><td>${cases.sevenDays}</td><td>${cases.thirtyDays}</td><td>${cases.total}</td><td>${cases.per100k}</td><td>${sparkline (cases.trend)}</td>
        <td>${deaths.oneDay}</td><td>${deaths.sevenDays}</td><td>${deaths.thirtyDays}</td><td>${deaths.total}</td><td>${deaths.per100k}</td><td>${sparkline (deaths.trend)}</td>
      </tr>`).join('\n      ')}
    </tbody>
    <tfoot>
      <tr>
        <th title="Population: ${populations['United States']}><a href="#/United+States">United States</a></th>
        <th>${totals.cases.oneDay}</th><th>${totals.cases.sevenDays}</th><th>${totals.cases.thirtyDays}</th><th>${totals.cases.total}</th><th>${totals.cases.per100k}</th><th>${footerSparkline (totals.cases.trend)}</th>
        <th>${totals.deaths.oneDay}</th><th>${totals.deaths.sevenDays}</th><th>${totals.deaths.thirtyDays}</th><th>${totals.deaths.total}</th><th>${totals.deaths.per100k}</th><th>${footerSparkline (totals.cases.trend)}</th>
      </tr>
    </tfoot>
  </table>`;
  [...national.querySelectorAll(`th[data-sort^="${path}"]`)].forEach(node => node.classList.add(direction))

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

const stateChooser = (populations, days) => {
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
       national .open = true
       document.getElementById('charts').innerHTML = ''
       document.getElementById('raw').innerHTML = ''
    }
  }

  window.addEventListener('popstate', chooseState);
  chooseState()
}



const buildUI = (populations) => (allDays) => {
  const states = 
    Object .entries (groupBy (s => s.state) (allDays)) .map (([state, days]) => [state, {
      cases: {
        total: days .slice (-1) [0] .cases,
        per100k: round(days .slice (-1) [0] .cases / populations[state] * 100000),
        oneDay: days .slice (-1) [0] .cases - days .slice (-2, -1) [0] .cases,
        sevenDays: days.slice (-1) [0] .cases - days .slice (-8, -7) [0] .cases,
        thirtyDays: days.slice (-1) [0] .cases - days .slice (-31, -1) [0] .cases,
        trend: nDayAvg (7) (diffs (pluck ('cases') (days)))

      },
      deaths: {
        total: days .slice (-1) [0] .deaths,
        per100k: round(days .slice (-1) [0] .deaths / populations[state] * 100000),
        oneDay: days .slice (-1) [0] .deaths - days .slice (-2, -1) [0] .deaths,
        sevenDays: days.slice (-1) [0] .deaths - days .slice (-8, -7) [0] .deaths,
        thirtyDays: days.slice (-1) [0] .deaths - days .slice (-31, -1) [0] .deaths,
        trend: nDayAvg (7) (diffs (pluck ('deaths') (days)))
      }
    }]) .sort (([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  const idx = states .findIndex(([s]) => s == "United States")
  const totals = {state: states [idx] [0], ...states [idx] [1]};
  const byState = [...states .slice (0, idx), ... states .slice (idx +1)]
    .map (([state, {cases, deaths}]) => ({state, cases, deaths}))

  let sortField = {path: 'state', type: 'alpha', ascend: true}; // ugly nasty state.
  addNational (populations, allDays, {totals, byState, path: 'state', direction: 'ascend'});
  stateChooser (populations, allDays)
  document.getElementById('national').addEventListener('click', (e) => {
     if (e.target.nodeName == 'TH') {
      const sorter = e .target .dataset .sort
      if (sorter) {
        const [path, type] = sorter .split (':')
        const ascend = (sortField.path == path) ? !sortField.ascend : true
        sortField = {type, path, ascend}
        byState.sort((sortType[type] || always0)(path, ascend))
        addNational (populations, allDays, {totals, byState, path, direction: ascend ? 'ascend': 'descend'});
      }
    }
  })
}

const displayError = (err) =>
  document .getElementById ('title') .innerHTML = `Problem loading data: ${err}`


const populations = ((pops) => ({
  ...pops,
  "United States": sum (Object .values (pops))
})) ({
  // from https://api.census.gov/data/2019/pep/population?get=POP,NAME&for=state:*
  ...({Alabama: 4903185, Alaska: 731545, Arizona: 7278717, Arkansas: 3017804, California: 39512223, Colorado: 5758736, Connecticut: 3565287, Delaware: 973764, 'District of Columbia': 705749, Florida: 21477737, Georgia: 10617423, Hawaii: 1415872, Idaho: 1787065, Illinois: 12671821, Indiana: 6732219, Iowa: 3155070, Kansas: 2913314, Kentucky: 4467673, Louisiana: 4648794, Maine: 1344212, Maryland: 6045680, Massachusetts: 6892503, Michigan: 9986857, Minnesota: 5639632, Mississippi: 2976149, Missouri: 6137428, Montana: 1068778, Nebraska: 1934408, Nevada: 3080156, 'New Hampshire': 1359711, 'New Jersey': 8882190, 'New Mexico': 2096829, 'New York': 19453561, 'North Carolina': 10488084, 'North Dakota': 762062, Ohio: 11689100, Oklahoma: 3956971, Oregon: 4217737, Pennsylvania: 12801989, 'Puerto Rico': 3193694, 'Rhode Island': 1059361, 'South Carolina': 5148714, 'South Dakota': 884659, Tennessee: 6829174, Texas: 28995881, Utah: 3205958, Vermont: 623989, Virginia: 8535519, Washington: 7614893, 'West Virginia': 1792147, Wisconsin: 5822434, Wyoming: 578759}),
  // with additional territory information from http://en.wikipedia.com/wiki
  ...({Guam: 168485, "Northern Mariana Islands": 56882, "Virgin Islands": 106977})
})

fetch ('https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-states.csv')
  .then (r => r .text ())
  .then (csv2arr)
  .then (addUnitedStates)
  .then (tap (buildUI (populations)))
  .catch (displayError)
