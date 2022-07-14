const db = require('./db')
const { Bot } = require('grammy')
const config  = require('../config')
const log = require('./logger').Logger('bot')
const {toHex, fromBech32, fromHex, toBech32} = require('@cosmjs/encoding')

const bot = new Bot(config.BOT_TOKEN)
bot.use(async (ctx, next) => {
	const telegramUser =
		ctx.update?.message?.from ??
		ctx.update?.callback_query?.from ??
		ctx.update?.my_chat_member?.from
	if (telegramUser) {
		const last_active = Date.now()
		ctx.user = (
			await db.col.users.findOneAndUpdate(
				{ id: telegramUser.id },
				{
					$set: {
						id: telegramUser.id,
						username: telegramUser.username,
						last_active,
						is_active: true,
					},
				},
				{ upsert: true }
			)
		).value
	} else {
		log.warn('unknown action user update', ctx)
	}
	return next()
});
const helpMessage = 'Just send an address : ) \n\n\nAlso, you can send address with prefix in format <address>:<prefix>. For example `osmo1rxgykl9vgkjwaq5q99lu66vdt30c4py7dgzhl7:omniflix`, will convert osmosis address to OmniFlix (`omniflix1rxgykl9vgkjwaq5q99lu66vdt30c4py7cdq77j`) address. But be aware if you make mistake in `prefix` it will convert absolutely different address then you expect! ⚠️ Use this feature on your own risk, if addresses has different coin types it will convert wrong! ⚠️'
const aboutMessage = 'This bot was created by [MELLIFERA](https://mellifera.network). Star on [GitHub](https://github.com/MELLIFERA-Labs/cosmovert)\nSupport us: cosmos1qcual5kgmw3gqc9q22hlp0aluc3t7rnsprewgy.\nNeed more? convert it 😉 '
bot.command('start', async ctx => ctx.reply(`Just send me an address :)\nThis bot can convert one address from one network to another in Cosmos ecosystem. Only 118 type coins!`));
bot.command('help', ctx => ctx.reply(helpMessage, {parse_mode: 'Markdown'}))
bot.command('about', ctx => ctx.reply(aboutMessage, {parse_mode: 'Markdown'}))
const supportedNetworkMessage = config.DEFAULT_NETWORKS.reduce((acc, cur) => {
	acc += `- ${cur.name}\n`
	return acc;
}, '')
bot.on('message', async ctx => {
	const rawStr = ctx.msg.text
	const str = rawStr.trim().toLowerCase()
	const [part1, part2] = str.split(':')
	if(!isAddress(part1)) return ctx.reply('Please, enter an address from cosmos ecosystem')
	if(!part2) {
		if(!config.DEFAULT_NETWORKS.find(it => it.prefix === part1.split('1')[0])) {
			return ctx.reply(`Highly recommend to use tested network:\n${supportedNetworkMessage}`)
		}
		const hexData = toHex(fromBech32(part1).data)
		const addresses = config.DEFAULT_NETWORKS.map(network => ({
			name: network.name,
			address: toBech32(network.prefix, fromHex(hexData))
		}))
		const msg = addresses.reduce((acc, cur) => {
			acc += `${cur.name} -> ${cur.address}\n`
			return acc;
		}, '')
		return ctx.reply(msg);
	}
	if(part1 && part2) {
		const hexData = toHex(fromBech32(part1).data)
		const address = toBech32(part2, fromHex(hexData))

		await ctx.reply(`Address -> ${address}`)
		await ctx.reply('❗️❗️❗️❗️❗️ Make sure that prefix is correct, if you make mistake in prefix address will convert wrong. Also, you have to make sure that the addresses have same derivation path/coinType ❗❗️❗️❗️ ⚠️ Use this feature on your own risk ⚠️')
	}
});

bot.on('my_chat_member', async ctx => {
	if(ctx.chat.type === 'private' &&
		ctx.myChatMember.old_chat_member.status === 'member' &&
		ctx.myChatMember.new_chat_member.status === 'kicked') {
		await db.col.users.updateOne(
			{ id: ctx.update.my_chat_member.from.id },
			{ $set: { is_active: false } }
		)
	}
});
function isAddress(address) {
	try{
		fromBech32(address)
		return true
	}catch {
		return false
	}
}

(async function main() {
	await db.connect()
	await bot.start()
})()