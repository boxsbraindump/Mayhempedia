// 一次性诊断脚本：等英雄联盟客户端真的打开(最好已经进了一把海克斯大乱斗)再跑这个。
// 目的：找到LCU暴露"完整海克斯定义(含Riot内部真实数字id)"的真实接口，
// 因为CommunityDragon的 cdragon/arena 接口漏了107个海克斯大乱斗专属海克斯(详见对话记录)，
// 而 src/match-history.ts 靠 playerAugment1..6 这些数字id 查稀有度——不能瞎编id顶上去。
//
// v1版本靠瞎猜几个"看起来像"的路径，试了两轮(登录大厅/实际对局中)全部404，说明猜的路径本身就是错的。
// v2改用LCU自带的swagger/OpenAPI自描述接口——这是客户端自己暴露的"我有哪些接口"清单，
// 不用再猜，直接从清单里筛selection含"augment"/"cherry"字样的真实路径。
//
// 用法：node scripts/fetch-augments-from-lcu.mjs

import { authenticate, createHttp1Request } from 'league-connect'

const SWAGGER_PATHS = ['/swagger/v3/openapi.json', '/swagger/v2/swagger.json']

async function main() {
  console.log('等待英雄联盟客户端…')
  const credentials = await authenticate({ awaitConnection: true })
  console.log(`已连接 LCU (port ${credentials.port})\n`)

  let spec = null
  let specSource = null
  for (const url of SWAGGER_PATHS) {
    try {
      const res = await createHttp1Request({ method: 'GET', url }, credentials)
      if (res.ok) {
        spec = await res.json()
        specSource = url
        console.log(`✅ 拿到接口清单: ${url}`)
        break
      }
      console.log(`[${res.status}] ${url} 不可用`)
    } catch (err) {
      console.log(`[ERROR] ${url}: ${err}`)
    }
  }

  if (!spec) {
    console.log('\n两个swagger端点都拿不到，客户端这个版本可能没开自描述接口。需要换别的办法。')
    process.exit(1)
  }

  const paths = spec.paths ?? {}
  const matches = Object.keys(paths).filter((p) => /augment|cherry/i.test(p))
  console.log(`\n从 ${specSource} 里筛出 ${matches.length} 条含"augment"/"cherry"的接口路径：\n`)
  for (const p of matches) {
    const methods = Object.keys(paths[p]).join(',').toUpperCase()
    console.log(`  [${methods}] ${p}`)
  }

  console.log('\n开始逐个试 GET 这些路径，看哪个真的返回海克斯定义数据…\n')
  for (const p of matches) {
    const methods = Object.keys(paths[p])
    if (!methods.includes('get')) continue
    try {
      const res = await createHttp1Request({ method: 'GET', url: p }, credentials)
      const bodyText = await res.text()
      const preview = bodyText.slice(0, 500)
      console.log(`[${res.status}] GET ${p}`)
      console.log('  ' + preview.replace(/\n/g, ' '))
      console.log('')
    } catch (err) {
      console.log(`[ERROR] GET ${p}: ${err}\n`)
    }
  }

  console.log('把上面status=200且内容像海克斯定义(含apiName/rarity/id字段、数量应该有大几百条)的那条路径和完整输出发给我。')
  process.exit(0)
}

main().catch((err) => {
  console.error('连接LCU失败:', err)
  process.exit(1)
})
