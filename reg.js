const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
const d3 = require('d3-dsv')
const fs = require('fs')
const PuppUtils = require('./lib/PuppUtils')
const fetch = require('node-fetch')
const {nanoid} = require('nanoid')

const SLOW_MO = 300

var storage
var infos = []

const MUG_VARIATION = {
    "Size": {
        '11oz': {
            price: 13.95
        },
        '15oz': {
            price: 16.95
        }
    },
    "Color": {
        'Black': {
            price: 0
        },
        'White': {
            price: 0
        }
    }
}

main()
async function main() {
    try {
        storage = JSON.parse(fs.readFileSync('./input/storage.txt', 'utf-8'))

        const tsvObject = d3.tsvParse(fs.readFileSync('./input/infos.tsv', 'utf-8'))

        for (const temp in tsvObject) {
            if (temp == 'columns') {
                continue
            }

            infos[Number(temp)] = tsvObject[temp]
        }

        for(let i = 0; i < infos.length; i++) {
            if(infos[i].status=="Suspended"){
                return
            }
            else{
                let info = infos[i]
                console.log(info)
                await startRegAccount(info)
            }
        }
    } catch (err) {
        console.error(err)
    }
}

async function startRegAccount(info){
    const browser = await puppeteer.launch({
        headless: false, defaultViewport: null, slowMo: 50,
        executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
        userDataDir: `./CR/${info.mail.trim().toLowerCase()}`,
        args: ['--no-sandbox', '--start-maximized']
    })
    const page = await browser.newPage()
    await page.goto('https://mail.google.com/mail/u/0/#inbox')

    await page.waitForTimeout(2000)
    if (page.url().includes('https://mail.google.com/mail/u/0/#inbox')) {
        await loginEtsy(browser, page, info)
    } else {
        await loginGoogle(page, info)
        await page.waitForTimeout(2000)
        if (page.url().includes('https://mail.google.com/mail/u/0/#inbox')) {
            await loginEtsy(browser, page, info)
        }else if(page.url().includes('https://myaccount.google.com/signinoptions/recovery-options-collection?')) {
            await confirmRecoveryOption(browser, page, info)
        }
    }
    return

    // await page.waitForSelector('#')
    // let element = ''
    // element = await page.$('.select-signin')
}

async function loginGoogle(page, info) {
    await PuppUtils.typeText(page, '#identifierId', info.mail.trim().toLowerCase())
    // await PuppUtils.setValue(page, '#identifierId', info.mail.trim().toLowerCase())

    await PuppUtils.waitNextUrl(page, '#identifierNext')

    // await page.waitForTimeout(4000)
    await PuppUtils.jsWaitForSelector(page, '[name="password"]', 4000)
    await page.waitForTimeout(1000)
    await PuppUtils.typeText(page, '[name="password"]', info.password.trim())
    // await PuppUtils.setValue(page, '[name="password"]', info.password.trim())

    await PuppUtils.waitNextUrl(page, '#passwordNext')
}

async function loginEtsy(browser, page, info) {

    await page.goto('https://www.etsy.com')

    if (await PuppUtils.isElementVisbile(page, '.select-signin')) {

    } else {
        await registerShop(page, info)
        return
    }
    let element = ''

    element = await page.$('.select-signin')
    await element.click()

    await page.waitForTimeout(2000)
    await PuppUtils.click(page, 'button[data-google-button="true"]')


    const newPagePromise = new Promise(x => browser.once('targetcreated', target => x(target.page())))
    const newPage = await newPagePromise

    await PuppUtils.click(newPage, `[data-email="${info.mail}"]`)

    await page.waitForTimeout(6000)

    if (await PuppUtils.isElementVisbile(page, '[aria-describedby="ge-tooltip-label-you-menu"]')) {
        await registerShop(page, info)
        return
    }
}

async function registerShop(page, info) {
    await page.goto('https://www.etsy.com/sell?ref=hdr-sell&from_page=https%3A%2F%2Fwww.etsy.com%2F')
    await page.goto('https://www.etsy.com/your/shop/create?us_sell_create_value')

    onNextStep(page, info)
}

async function onNextStep(page, info) {
    // Step 1
    if (await PuppUtils.isElementVisbile(page, '#address-country')) {
        await submitShoppreferences(page, info)  // Step 1
        // await page.waitForTimeout(3000)
    } else if (await PuppUtils.isElementVisbile(page, '#onboarding-shop-name-input')) {   // Step 2
        await submitShopName(page, info)
        // await page.waitForTimeout(3000)
    } else if (await PuppUtils.jsIsSelectorExisted(page, '[data-region="listings-container"] a')) {   // Step 3
        await createNewListing(page, info)
        // await page.waitForTimeout(3000)
    } else if (await PuppUtils.isElementVisbile(page, '[data-ui="business-or-individual"]')) {   // Step 3
        await submitBussinessInfo(page, info)
        return
    }
    await checkStatusAccount(page, info)
    await page.waitForTimeout(3000)
    await onNextStep(page, info)
}

async function checkStatusAccount(page, info){
    if((await page.content()).includes('Your account is currently suspended')){
        info.status = "Suspended"
        fs.writeFileSync('./input/infos.tsv', d3.tsvFormat(info), 'utf8')
    }
}

async function submitShoppreferences(page, info) {
    //Change language step 1
    await PuppUtils.click(page, 'button[aria-controls="wt-locale-picker-overlay"]')
    await page.waitForTimeout(1000)
    element = await page.$('#locale-overlay-select-region_code')
    await element.click()
    await page.waitForTimeout(200)
    await page.evaluate(() => {
        $('#locale-overlay-select-region_code').get(0).size = 1000
    })
    element = await page.$('#locale-overlay-select-region_code [value="CA"]')
    await element.click()
    //Change language step 2
    await page.waitForTimeout(500)
    element = await page.$('#locale-overlay-select-language_code')
    await element.click()
    await page.waitForTimeout(200)
    await page.evaluate(() => {
        $('#locale-overlay-select-language_code').get(0).size = 1000
    })
    element = await page.$('#locale-overlay-select-language_code [value="en-US"]')
    await element.click()
    //Change language step 3
    await page.waitForTimeout(500)
    element = await page.$('#locale-overlay-select-currency_code')
    await element.click()
    await page.waitForTimeout(200)
    await page.evaluate(() => {
        $('#locale-overlay-select-currency_code').get(0).size = 1000
    })
    element = await page.$('#locale-overlay-select-currency_code [value="USD"]')
    await element.click()

    await PuppUtils.click(page, '#locale-overlay-save')

    await page.waitForTimeout(2500)

    element = await page.$('#onboard-shop-currency')
    await element.click()
    await page.waitForTimeout(200)
    await page.evaluate(() => {
        $('#onboard-shop-currency').get(0).size = 1000
    })
    element = await page.$(`[value="USD"]`)
    await element.click()

    await page.waitForTimeout(SLOW_MO)
    await page.evaluate(() => {
        $('[name="intention"]:eq(0)').click()
    })

    await PuppUtils.click(page, 'button[data-subway-next="true"]')
    await page.waitForTimeout(1000)
}

async function submitShopName(page, info) {
    await page.waitForSelector('#onboarding-shop-name-input')
    await generateShopName(page, info)
    
    await PuppUtils.click(page, 'button[data-subway-next="true"]')
}

async function generateShopName(page, info) {
    try {
        let shopName = info.mail.split('@')[0] + Math.floor(Math.random() * 90 + 10)
        await PuppUtils.typeText(page, '#onboarding-shop-name-input', shopName)
        await PuppUtils.click(page, '[data-action="check-availability"]')
        await page.waitForTimeout(1000)
        if(await PuppUtils.isElementVisbile(page, '#available[style="display: block;"]')){

        // let response = await fetch(`https://www.etsy.com/api/v3/ajax/bespoke/member/shops/name/check?shop_name=${shopName}&is_vintage=false&is_handmade=false&category=`, {
        //     "headers": {
        //         "accept": "*/*",
        //         "accept-language": "en-US,en;q=0.9",
        //         "sec-fetch-dest": "empty",
        //         "sec-fetch-mode": "cors",
        //         "sec-fetch-site": "same-origin",
        //         "x-detected-locale": "USD|en-US|CA",
        //         "x-page-guid": "eb6426a3630.cb03e0a706416eedcb2e.00",
        //         "x-requested-with": "XMLHttpRequest",
        //         "cookie": "uaid=sTVfV0i5hz0l3Q4iydjMIWgV69VjZACChKzuqTC6Wqk0MTNFyUqpoCqnwNQrOz6s2D87q9TDySjKK98lLMfNwjgnXamWAQA.; user_prefs=DPnPPXUuP-LwHGHbrqcz9fmW4YRjZACChKzuqTA6Wik02EVJJ680J0dHKTVPNzRYSUcpzA8qYgShcBGxDAA.; fve=1617595285.0; last_browse_page=https%3A%2F%2Fwww.etsy.com%2F; ua=531227642bc86f3b5fd7103a0c0b4fd6; _gcl_au=1.1.1691248584.1617595286; _ga=GA1.2.797361194.1617595286; _gid=GA1.2.578247052.1617595286; G_ENABLED_IDPS=google; G_AUTHUSER_H=0; session-key-www=471597983-1011811269410-45fe68289114e9d5f0b1c82230a656c92ffffd2e45d5151b17e3af61|1620187837; session-key-apex=471597983-1011811269410-13fdf22e58198b40baf02264fd78fde0abe79e8fb48893e1fdd3b075|1620187837; LD=1; bc-v1-1-1-_etsy_com=2%3A05d707340b9830e828078d75570a43785980d359%3A1617595837%3A1617595837%3Ad040efae7b142b79c7ea9e15adebe7f7d9b382e392de85b3649d6e2b6bb3af9ac42c1a89d72e2032; _pin_unauth=dWlkPU1qbGlZamN6WmpjdFkyWmtOeTAwTTJRMUxXSmtNell0T0dZeU1UWm1ZVEUzWVRCaA; _uetsid=97f4482095c311eb83b51565fd823fd6; _uetvid=97f44e2095c311ebadcc33437119bc6a; exp_hangover=9RxzWsWFgsnP6oP5MBgmUpHI9chjZACChKzuqRB6Unq1UnlqUnxiUUlmWmZyZmJOfE5iSWpecmV8oUm8kYGhpZKVUmZeak5memZSTqpSLQMA; et-v1-1-1-_etsy_com=2%3A2a05ae6c788fe15915581c85ce0f8e19b5c09c88%3A1617597031%3A1617597031%3A8a8636ff07c68946846f95451d9dcfcfe393ff794ad0e35f2df58c70fcd484ecdfd40dae1a088597"
        //     },
        //     "referrer": "https://www.etsy.com/your/shop/create?us_sell_create_value",
        //     "referrerPolicy": "strict-origin-when-cross-origin",
        //     "body": null,
        //     "method": "GET",
        //     "mode": "cors"
        // })

        // let jsonResponse = await response.json()
        // if (jsonResponse.hasOwnProperty("result_type")) {
            console.log('Available', shopName)
            info.nameShop = shopName
            saveInfos(info)
            return Promise.resolve()
        } else {
            console.log('Not Available', shopName)
            generateShopName(page, info)
        }
    } catch (err) {
        return Promise.reject(err)
    }
}

async function createNewListing(page, info) {
    await page.goto(`https://www.etsy.com/your/shops/${info.shopName}/onboarding/listings/create`)
    let imagesFolderName = './input/' + String(storage.dataCount)
    let imageFiles = fs.readdirSync(imagesFolderName)

    for (let i = 0, l = imageFiles.length; i < l; i++) {
        let imageFile = imagesFolderName + '/' + imageFiles[i]
        let element = await page.$("#listing-edit-image-upload")
        await element.uploadFile(imageFile)
        await page.waitForTimeout(1500)
    }

    await PuppUtils.typeText(page, "#title-input", info.title)


    await page.waitForTimeout(SLOW_MO)
    let element = await page.$('#who_made-input')
    await element.click()
    await page.evaluate(() => {
        $(`#who_made-input`).get(0).size = 1000
    })
    element = await page.$('#who_made-input option[value="i_did"]')
    await element.click()

    await page.waitForTimeout(SLOW_MO)
    element = await page.$('#is_supply-input')
    await element.click()
    await page.evaluate(() => {
        $(`#is_supply-input`).get(0).size = 1000
    })
    element = await page.$('#is_supply-input option[value="false"]')
    await element.click()

    await page.waitForTimeout(SLOW_MO)
    element = await page.$('#when_made-input')
    await element.click()
    await page.evaluate(() => {
        $(`#when_made-input`).get(0).size = 1000
    })
    element = await page.$('#when_made-input option[value="made_to_order"]')
    await element.click()

    await page.waitForTimeout(SLOW_MO)

    await PuppUtils.typeText(page, "#taxonomy-search", info.category)
    await page.waitForTimeout(1500)
    await page.keyboard.press('Enter')
    await PuppUtils.typeText(page, "#description-text-area-input", info.description)
    // await PuppUtils.typeText(page, "#tags", info.tags)
    // await PuppUtils.click(page, '[data-region="tags"] button')

    await PuppUtils.typeText(page, "#price_retail-input", info.price)
    await PuppUtils.typeText(page, "#quantity_retail-input", "999")
    await PuppUtils.typeText(page, "#SKU-input", nanoid(10).replace(/-/g, ''))
    
    await PuppUtils.click(page, '#add_variations_button')

    await page.waitForTimeout(500)
    element = await page.$(`[name="variation_property"]`)
    await element.click()

    await page.waitForTimeout(200)
    await page.evaluate(() => {
        $(`[name="variation_property"]`).get(0).size = 1000
    })

    element = await page.$(`[value="__custom"]`)
    await element.click()

    // await page.waitForTimeout(SLOW_MO)
    for (variationType in MUG_VARIATION) {
        await page.waitForTimeout(500)
        let element = await page.$(`[name="variation_property"]`)
        await element.click()

        await page.waitForTimeout(200)
        await page.evaluate(() => {
            $(`[name="variation_property"]`).get(0).size = 1000
        })

        element = await page.$(`[value="__custom"]`)
        await element.click()

        await PuppUtils.typeText(page, '[name="custom-property-input"]', variationType)
        element = await page.evaluateHandle(() => {
            return $(`[name="variation_property"]`).parent().parent().find('[name="add-custom"]')[0]
        })
        await element.click()

        let flag = true
        for (const option in MUG_VARIATION[variationType]) {
            let parentBox = await page.evaluateHandle((variationType) => {
                return $(`[data-property-id] .strong [data-test-id="unsanitize"]:contains(${variationType})`).parent().parent().parent().parent().get(0)
            }, variationType)

            if (flag) {
                element = await parentBox.$('[name="price-control"]')
                await element.click()
                element = await parentBox.$('[name="sku-control"]')
                await element.click()

                flag = false
            }

            element = await parentBox.$('#undefined-input')
            await element.type(option)
            element = await parentBox.$('[name="add-custom"]')
            await element.click()
        }

    }

    await PuppUtils.click(page, '#save')
    await page.waitForTimeout(1000)

    let elements = await page.$$('#variations-table tbody tr')

    let variationTypes = Object.keys(MUG_VARIATION)
    if (variationTypes.length == 1) {

    } else if (variationTypes.length == 2) {
        let variationType1 = Object.keys(MUG_VARIATION)[0]
        let variationType2 = Object.keys(MUG_VARIATION)[1]

        let variationOptions1 = Object.keys(MUG_VARIATION[variationType1])
        let variationOptions2 = Object.keys(MUG_VARIATION[variationType2])

        for (let i = 0, l = variationOptions1.length; i < l; i++) {
            for (let j = 0, l2 = variationOptions2.length; j < l2; j++) {
                let option1 = variationOptions1[i]
                let option2 = variationOptions2[j]
                let price = String(MUG_VARIATION[variationType1][option1].price)

                let parentRow = await page.evaluateHandle((option1, option2) => {
                    let rows = $(`#variations-unified-table tbody tr`)
                    for (let k = 0, l3 = rows.length; k < l3; k++) {
                        let row = rows.eq(k)
                        if (row.find('td.width-20:eq(0)').text().trim() == option1 && row.find('td.width-20:eq(1)').text().trim() == option2) {
                            return row
                        }
                    }
                }, option1, option2)

                element = await page.evaluateHandle((parentRow) => {
                    return parentRow.find('[name="sku-input"]').get(0)
                }, parentRow)

                await element.type(nanoid(10).replace(/-/g, ''))

                element = await page.evaluateHandle((parentRow) => {
                    return parentRow.find('[name="price-input"]').get(0)
                }, parentRow)

                await element.type(price)
            }
        }
    }
    await page.waitForTimeout(SLOW_MO)
    element = await page.$('#profile_type')
    await element.click()
    await page.evaluate(() => {
        $(`#profile_type`).get(0).size = 1000
    })
    element = await page.$('#profile_type [value="manual"]')
    await element.click()

    await page.waitForTimeout(SLOW_MO)
    element = await page.$('#shipping_country')
    await element.click()
    await page.evaluate(() => {
        $(`#shipping_country`).get(0).size = 1000
    })
    element = await page.$('#shipping_country [value="209"]')
    await element.click()

    await PuppUtils.typeText(page, '#origin_postal_code', "10001")

    await page.waitForTimeout(SLOW_MO)
    element = await page.$('#processing_time_select')
    await element.click()
    await page.evaluate(() => {
        $(`#processing_time_select`).get(0).size = 1000
    })
    element = await page.$('#processing_time_select [value="4"]')
    await element.click()
    
    await page.waitForTimeout(1000)
    element = await page.evaluateHandle(() => {
        return $(`div.wt-grid.wt-pt-xs-4.wt-pb-xs-4:contains("Canada")`).find('.wt-grid__item-md-9 .wt-btn.wt-btn--transparent.wt-btn--icon')[0]
    })

    await element.click()
    
    await page.evaluate(() => {
        $('#processing_time_select option[value="3"]').attr("selected", "selected")
    })

    await PuppUtils.click(page, '[data-region="shipping-with-profile-management"] button')
    await PuppUtils.typeText(page, '#weight_primary', '1')
    await PuppUtils.typeText(page, '#item_length', '1')
    await PuppUtils.typeText(page, '#item_width', '1')
    await PuppUtils.typeText(page, '#item_height', '1')
    await PuppUtils.click(page, '.page-footer [data-save]')

    await page.waitForTimeout(4000)
    if(await PuppUtils.jsIsSelectorExisted(page, '[data-region="listings-container"] a')){
        await PuppUtils.click(page, '[data-subway-next="true"] ')
    }
}

async function submitBussinessInfo(page, info){
    await page.evaluate(() => {
        element = document.querySelector('#bank-country-id');
        if ( element ) {
            element.scrollTop = element.offsetHeight;
            console.error(`Scrolled to selector}`)
        } else {
            console.error(`cannot find selector`)
        }
    })


    await page.waitForTimeout(SLOW_MO)
    element = await page.$('#bank-country-id')
    await element.click()
    await page.evaluate(() => {
        $(`#bank-country-id`).get(0).size = 1000
    })
    element = await page.$('#bank-country-id [value="209"]')
    await element.click()
    await page.waitForTimeout(SLOW_MO)
    await PuppUtils.typeText(page, "#bank-name-on-account", info.firstName+" "+info.middleName+" "+info.lastName)
    await PuppUtils.typeText(page, "#bank-routing-number", info.rountingNumber)
    await PuppUtils.typeText(page, "#bank-account-number", info.accountNumber)

    await page.evaluate(() => {
        element = document.querySelector('#identity-country-id');
        if ( element ) {
            element.scrollTop = element.offsetHeight;
            console.error(`Scrolled to selector}`)
        } else {
            console.error(`cannot find selector`)
        }
    })

    await page.waitForTimeout(SLOW_MO)
    element = await page.$('#identity-country-id')
    await element.click()
    await page.evaluate(() => {
        $(`#identity-country-id`).get(0).size = 1000
    })
    element = await page.$('#identity-country-id [value="79"]')
    await element.click()
    await page.waitForTimeout(SLOW_MO)
    await PuppUtils.typeText(page, "#identity-first-name", info.firstName)
    await PuppUtils.typeText(page, "#identity-last-name", info.lastName)
    //dob month
    await page.waitForTimeout(SLOW_MO)
    element = await page.$('#dob-container-month')
    await element.click()
    await page.evaluate(() => {
        $(`#dob-container-month`).get(0).size = 1000
    })
    element = await page.$(`#dob-container-month [value="${getDateOfBirth(0, info)}"]`)
    await element.click()
    //dob date
    await page.waitForTimeout(SLOW_MO)
    element = await page.$('#dob-container-day')
    await element.click()
    await page.evaluate(() => {
        $(`#dob-container-day`).get(0).size = 1000
    })
    element = await page.$(`#dob-container-day [value="${getDateOfBirth(1, info)}"]`)
    await element.click()
    //dob year
    await page.waitForTimeout(SLOW_MO)
    element = await page.$('#dob-container-year')
    await element.click()
    await page.evaluate(() => {
        $(`#dob-container-year`).get(0).size = 1000
    })
    element = await page.$(`#dob-container-year [value="${getDateOfBirth(2, info)}"]`)
    await element.click()
    await page.waitForTimeout(SLOW_MO)

    await PuppUtils.typeText(page, 'input[name="street_number"]', getAddress(0, info))
    await PuppUtils.typeText(page, 'input[name="street_name"]', getAddress(1, info))
    await PuppUtils.typeText(page, '.address-container input[name="city"]', info.city)
    //dob state
    await page.waitForTimeout(SLOW_MO)
    element = await page.$('.address-container [name="state"]')
    await element.click()
    await page.evaluate(() => {
        $(`.address-container [name="state"]`).get(0).size = 1000
    })
    element = await page.$(`.address-container [name="state"] [value="${info.state}"]`)
    await element.click()
    await page.waitForTimeout(SLOW_MO)

    await PuppUtils.typeText(page, '.address-container input[name="zip"]', info.zip)

    await PuppUtils.typeText(page, '.address-container input[name="phone"]', info.phone)
    await PuppUtils.click(page, 'button[data-ui="dc-submit"]')
}

function getAddress(order, info){
    let address = info.address.trim().split(" ")
    if(order == 0){
        return address[order]
    }else{
        let streetName = "";
        for(let i = 1; i < address.length; i++ ){
            streetName += address[i] + " "
        }
        return streetName.trim()
    }
}

function getDateOfBirth(order, info){
    let dob = info.dob.trim().split("/")
    return dob[order]
}

function saveInfos(info) {
    fs.writeFileSync('./input/infos.tsv', d3.tsvFormat(info), 'utf8')
}

function confirmRecoveryOption(browser, page, info){

}

// function randomSku() {
//     return String(Math.floor(Math.random() * 90000 + 10000))
// }