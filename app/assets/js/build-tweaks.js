/* ************************************************************************** *\
|** ************************************************************************ **|
|** MZD-AIO-TI                                                               **|
|** By: Trezdog44 - Trevor Martin                                            **|
|** http://mazdatweaks.com                                                   **|
|** ©2017 Trevelopment                                                       **|
|**                                                                          **|
|** build-tweaks.js - The main 'builder' component copys neccesary files to  **|
|** a temporary folder for copying to a usb additionaly                      **|
|** gives the option to copy files directly to an available usb drive.       **|
|**                                                                          **|
|** ************************************************************************ **|
\* ************************************************************************** */
/* jshint esversion:6 */
/* jshint -W033 */
var approot
if (isDev) {
  approot = './app/' // for dev
} else {
  approot = app.getAppPath() // for dist
}
var builddir = `${approot}/files/tweaks/` // Location of tweak files (as .txt files)
var extradir = app.getPath('userData') // Location of downloaded tweak files (userData)
var logFileName = 'MZD_LOG' // Name of log file (without extension)
var varDir = `${extradir}/background/` // Location of files with saved variables
const appender = require('appender') // Appends the tweak files syncronously
const crlf = require('crlf') // Converts line endings (from CRLF to LF)
const copydir = require('copy-dir') // Copys full directories
const drivelist = require('drivelist') // Module that gets the list of available USB drives
const extract = require('extract-zip') // For Unzipping
const mkdirp = require('mkdirp') // Equiv of Unix command mkdir -p
const rimraf = require('rimraf') // Equiv of Unix command rm -rf
// First line of AIO log
var AIO_LOG = `# __MZD-AIO-TI__ ${app.getVersion()}| MZD All In One Tweaks Installer\n#### AIO COMPILATION LOG - ${Date()}\r\n___\n- *START!*\n`
var AIO_LOG_HTML = `<button class="w3-btn w3-hover-teal w3-display-bottomright w3-margin" onclick="saveAIOLogHTML()">Save Log (HTML)</button><div id="aio-comp-log" class="aio-comp-log"><h1><b>MZD-AIO-TI ${app.getVersion()}</b> | MZD All In One Tweaks Installer</h1><br><h4> AIO COMPILATION LOG - ${Date()}</h4><hr><div><ul><li><b><i>START!</i></b></li>`
var userView = document.getElementById(`userLogView`)
var fileCount = 0 // Number of files in the Queue
var opsComplete = false // Flag to signal writing of tweaks.sh file is completed
var filesComplete = true // Flag to signal the files have all been copied
var disclaimerAndAudioFlag = false // Flag to prevent disclaimer&audiosource folder from being copied twice
var errFlag = false // Error flag
var copySwapfile = false // Swapfile flag
var tweaks2write = [] // Queue for order consistantcy writing tweaks.sh (Always starts with 00_intro.txt)
var tmpdir = path.normalize(path.join(persistantData.get('copyFolderLocation'), '_copy_to_usb')) // Place to hold USB drive files before copying
var themeColor = 'Red' // Default color
var swapdest = ''
var keeplog = true
/*                                      *********\
|*  START BUILD OF TWEAKS.SH & ASSOCIATED FILES *|
\**********                                     */
function buildTweakFile(user, apps) {
  keeplog = !user.autorun.serial
  /* Set _copy_to_usb folder location */
  tmpdir = path.normalize(path.join(persistantData.get('copyFolderLocation'), '_copy_to_usb'))
  /* Start building tweaks.sh */
  tweaks2write = [`${builddir}00_intro.txt`]
  /* * Add Variables * */
  tweakVariables(user)
  tweaks2write.push(`${builddir}00_start.txt`)
  /* Start Writing Log Files */
  AIO_LOG += `- Tweak Files Location: ${tmpdir}\r\n`
  AIO_LOG_HTML += `<li><b>Tweak Files Location: ${tmpdir}</b></li>`
  /* Building Dialog */
  bootbox.dialog({
    message: `<div style='text-align:center;'>${langObj.popupMsgs[0].msg}<br><div id='userLogView' style='text-align:center;' ></div><br><img class='loader' src='./files/img/load-1.gif' alt='...' /></div><div id='copy-loc'>${langObj.popupMsgs[1].msg}: ${tmpdir}<span class="w3-close icon-x w3-right" onclick="$(this).parent().hide()"></span></div>`,
    closeButton: false
  })
  saveInstallerOps(user)
  if (fs.existsSync(`${tmpdir}`)) {
    aioLog('Delete old _copy_to_usb folder...')
  }
  try {
    // delete tmp folder if it exists and make new tmpdir
    rimraf.sync(`${tmpdir}`)
  } catch (e) {
    let m = `Error occured while deleting old '_copy_to_usb' folder: ${e}\n Try closing all other running programs and folders before compiling.`
    aioLog(m, m)
    finishedMessage()
    return
  }
  setTimeout(() => {
    /* Autorun Script Installer */
    if (user.autorun.installer) {
      buildAutorunInstaller(user)
      return
    }
    try {
      mkdirp.sync(`${tmpdir}/`)
      mkdirp.sync(`${tmpdir}/config/`)
      // mkdirp.sync(`${tmpdir}/config_org/`)
    } catch (e) {
      m = `${e} - Error occured while creating '_copy_to_usb' folder. Try closing all other running programs and folders before compiling.`
      aioLog(e.message, m)
      finishedMessage()
      return
    }
    /* Full System Restore Script */
    if (user.restore.full) {
      fullSystemRestore(user)
      return
    }
    /* CASDK Installer */
    if (user.casdk.inst || user.casdk.uninst) {
      if (apps) {
        buildCASDK(user, apps)
        rimraf.sync(`${tmpdir}/config/`)
        rimraf.sync(`${tmpdir}/config_org/`)
        return
      }
    }
    // first back up JCI folder if chosen
    if (user.mainOps.includes(1)) {
      addTweak('00_backup.txt')
    }
    if (user.mainOps.includes(0) || user.options.includes(21)) {
      addTweak('00_wifi.txt')
    }
    if (user.mainOps.includes(4) || user.options.includes(21)) {
      addTweak('00_sshbringback.txt')
      addTweakDir('ssh_bringback', true)
    }
    if (user.options.includes(16)) {
      addTweakDir('blank-album-art-frame', true)
      mkdirp.sync(`${tmpdir}/config/blank-album-art-frame/jci/gui/common/images/`)
      var outStr = fs.createWriteStream(`${tmpdir}/config/blank-album-art-frame/jci/gui/common/images/no_artwork_icon.png`)
      var inStr = fs.createReadStream(`${varDir}/no_artwork_icon.png`)
      outStr.on('close', function() {
        aioLog('Blank Album Art Copy Successful!')
        checkForColorScheme(user)
      })
      outStr.on('error', function(err) {
        aioLog(err, 'Blank Album Art Copy FAILED!')
      })
      inStr.pipe(outStr)
    } else {
      checkForColorScheme(user)
    }
  }, 1000)
}
/* Check For Color Scheme Tweak */
function checkForColorScheme(user) {
  if (user.mainOps.includes(3)) {
    if (user.colors > 16) {
      customTheme(themeColor, user)
    } else if (user.colors < 8 || user.colors === 11) { // 11 for CarOS theme
      setColor(themeColor, user)
    } else {
      setTheme(themeColor, user)
    }
  } else {
    buildTweak(user)
  }
}

function customTheme(color, user) {
  if (user.customTheme) {
    if (user.customTheme[0].substr(user.customTheme.length - 4) === 'jci') {
      aioLog(`Copying ${user.customTheme} Theme Folder`)
      copydir(`${user.customTheme}`, `${tmpdir}/config/color-schemes/theme/jci/`, function(stat, filepath, filename) {
        if (stat === 'file' && path.extname(filepath) !== '.png') {
          return false
        }
        return true
      }, function(err) {
        if (err) { aioLog(err, err) } else { aioLog(`Custom Theme Copied Successfully.`) }
        buildTweak(user)
      })
    } else {
      aioLog(`ERROR: INVALID THEME FOLDER`, `ERROR: INVALID THEME FOLDER: ${user.customTheme[0].substr(user.customTheme.length - 4)}   Please Select a 'jci' Folder To Use Custom Theme`)
    }
  } else {
    aioLog(`Custom theme not found, Copy the jci folder from a MZD Theme Package to '/config/color-schemes/theme/' To Use Your Theme`)
    mkdirp.sync(`${tmpdir}/config/color-schemes/theme/jci/`)
    buildTweak(user)
  }
}

function setTheme(color, user) {
  aioLog(`Unzipping ${color} Theme Folder`)
  extract(`${builddir}/config/themes/${color}.zip`, { dir: `${tmpdir}/config/color-schemes/theme/` }, function(err) {
    if (err) { aioLog(err, err) }
    aioLog(`${color} Theme Folder Unzipped & Added.`)
    if (!user.useColorBG) {
      if (fs.existsSync(`${tmpdir}/config/color-schemes/theme/jci/gui/common/images/background.png`)) {
        fs.unlinkSync(`${tmpdir}/config/color-schemes/theme/jci/gui/common/images/background.png`)
      }
      aioLog('Removed Theme Background')
    }
    if (fs.existsSync(`${tmpdir}/config/color-schemes/theme/jci/gui/common/images/no_artwork_icon.png`)) {
      fs.unlinkSync(`${tmpdir}/config/color-schemes/theme/jci/gui/common/images/no_artwork_icon.png`)
    }
    if (fs.existsSync(`${tmpdir}/config/color-schemes/theme/jci/gui/apps/system/controls/OffScreen/images/OffScreenBackground.png`)) {
      fs.unlinkSync(`${tmpdir}/config/color-schemes/theme/jci/gui/apps/system/controls/OffScreen/images/OffScreenBackground.png`)
    }
    buildTweak(user)
  })
}

function setColor(color, user) {
  fs.mkdirSync(`${tmpdir}/config/color-schemes`)
  aioLog(`Unzipping ${color} color theme folder`)
  extract(`${extradir}/color-schemes/${color}/jci.zip`, { dir: `${tmpdir}/config/color-schemes/${color}` }, function(err) {
    if (err) { aioLog(err, err) }
    aioLog(`${color} Color Scheme Folder Unzipped... Continue Build.`)
    if (user.colors === 1) {
      fs.createReadStream(`${extradir}/color-schemes/Blue/_skin_jci_bluedemo.zip`).pipe(fs.createWriteStream(`${tmpdir}/config/color-schemes/Blue/_skin_jci_bluedemo.zip`))
      aioLog(`Copying Blue Color Scheme For Navigation`)
    }
    if (!user.useColorBG) {
      if (fs.existsSync(`${tmpdir}/config/color-schemes/${color}/jci/gui/common/images/background.png`)) {
        fs.unlinkSync(`${tmpdir}/config/color-schemes/${color}/jci/gui/common/images/background.png`)
      }
      aioLog('Removed Color Scheme Background')
    }
    if (fs.existsSync(`${tmpdir}/config/color-schemes/${color}/jci/gui/apps/system/controls/OffScreen/images/OffScreenBackground.png`)) {
      fs.unlinkSync(`${tmpdir}/config/color-schemes/${color}/jci/gui/apps/system/controls/OffScreen/images/OffScreenBackground.png`)
    }
    if (fs.existsSync(`${tmpdir}/config/color-schemes/${color}/jci/gui/common/images/no_artwork_icon.png`)) {
      fs.unlinkSync(`${tmpdir}/config/color-schemes/${color}/jci/gui/common/images/no_artwork_icon.png`)
    }
    buildTweak(user)
  })
}

function buildTweak(user) {
  // ****************************************************/
  // **********Write uninstalls first********************/
  // ****************************************************/
  if (user.options.includes(101)) {
    addTweak('01_touchscreen-u.txt')
  }
  if (user.options.includes(102)) {
    addTweak('02_disclaimer-u.txt')
  }
  if (user.options.includes(103)) {
    addTweak('03_warning-u.txt')
    addTweakDir('safety-warning-reverse-camera', false)
  }
  if (user.options.includes(104)) {
    addTweak('04_sensor-u.txt')
    addTweakDir('transparent-parking-sensor', false)
  }
  if (user.options.includes(105)) {
    addTweak('05_mainloop-u.txt')
    addTweakDir('main-menu-loop', false)
  }
  if (user.options.includes(106)) {
    addTweak('06_listloop-u.txt')
    addTweakDir('list-loop', false)
  }
  if (user.options.includes(107)) {
    addTweak('07_shorterdelay-u.txt')
  }
  if (user.options.includes(108)) {
    addTweak('08_sysbeep-u.txt')
  }
  if (user.options.includes(109)) {
    addTweak('09_audioorder-u.txt')
  }
  if (user.options.includes(110)) {
    addTweak('10_pausemute-u.txt')
  }
  if (user.options.includes(111)) {
    addTweak('11_msgreplies-u.txt')
    addTweakDir('message_replies', false)
  }
  if (user.options.includes(112)) {
    addTweak('12_diag-u.txt')
  }
  if (user.options.includes(113)) {
    addTweak('13_boot-u.txt')
    addTweakDir('bootanimation', false)
  }
  if (user.options.includes(114)) {
    addTweak('14_bgart-u.txt')
    addTweakDir('bigger-album-art', false)
  }
  if (user.options.includes(115)) {
    addTweak('15_btnbackground-u.txt')
    addTweakDir('NoButtons', false)
  }
  if (user.options.includes(116)) {
    addTweak('16_blnkframe-u.txt')
    addTweakDir('blank-album-art-frame', false)
  }
  if (user.options.includes(117)) {
    addTweak('17_videoplayer-u.txt')
  }
  if (user.options.includes(118)) {
    addTweak('18_swapfile-u.txt')
  }
  if (user.options.includes(119)) {
    addTweak('19_speedo-u.txt')
    addTweakDir('speedometer', false)
  }
  if (user.options.includes(122)) {
    addTweak('22_fuel-u.txt')
    addTweakDir('FuelConsumptionTweak', false)
  }
  if (user.options.includes(124)) {
    addTweak('24_castscreen-u.txt')
  }
  if (user.options.includes(125)) {
    addTweak('25_androidauto-u.txt')
    //addTweakDir('androidauto', false)
  }
  if (user.options.includes(121)) {
    addTweak('08_orderflac-u.txt')
    addTweakDir('media-order-patching', false)
  }
  if (user.options.includes(126)) {
    addTweak('26_usbaudiomod-u.txt')
    addTweakDir('USBAudioMod', false)
  }
  if (user.options.includes(127)) {
    addTweak('27_aioapp-u.txt')
  }
  if (user.mzdmeter.uninst) {
    addTweak('28_mzdmeter-u.txt')
  }
  if (user.mainOps.includes(106)) {
    addTweak('00_bgrotator-u.txt')
    addTweakDir('BackgroundRotator', false)
  }
  // reset flag for installs
  disclaimerAndAudioFlag = false
  // ****************************************************/
  // ******************Write Installs********************/
  // ****************************************************/
  if (user.mainOps.includes(3)) {
    if (user.colors === 0) {
      addTweak('21_colors-u.txt')
    } else if (user.colors < 8 || user.colors === 11) {
      addTweak('21_colors-i1.txt')
      addTweak('21_colors-i2.txt')
    } else {
      addTweak('21_theme-i.txt')
    }
  }
  if (user.options.includes(1)) {
    addTweak('01_touchscreen-i.txt')
  }
  if (user.options.includes(2)) {
    //  if (user.disclaimOps === 1) {
    //    addTweak('02_disclaimer5-i.txt')
    //} else {
    addTweak('02_disclaimer-i.txt')
    //  }
  }
  if (user.options.includes(3)) {
    addTweak('03_warning-i.txt')
    addTweakDir('safety-warning-reverse-camera', true)
  }
  if (user.options.includes(4)) {
    addTweak('04_sensor-i.txt')
    addTweakDir('transparent-parking-sensor', true)
  }
  if (user.options.includes(5)) {
    addTweak('05_mainloop-i.txt')
    addTweakDir('main-menu-loop', true)
  }
  if (user.options.includes(6)) {
    addTweak('06_listloop-i.txt')
    addTweakDir('list-loop', true)
  }
  if (user.options.includes(7)) {
    addTweak('07_shorterdelay-i.txt')
  }
  if (user.listbeep) {
    addTweak('07_listbeep-i.txt')
  }
  if (user.options.includes(8)) {
    addTweak('08_sysbeep-i.txt')
  }
  if (user.options.includes(9)) {
    addTweak('09_audioorder-i.txt')
  }
  if (user.options.includes(10)) {
    addTweak('10_pausemute-i.txt')
  }
  if (user.options.includes(19)) {
    addTweak('19_speedo-i1.txt', true)
    switch (user.speedoOps.lang.id) {
      case 1:
        break;
      case 2:
        addTweak('19_speedo-spanish.txt', true)
        break;
      case 3:
        addTweak('19_speedo-polish.txt', true)
        break;
      case 4:
        addTweak('19_speedo-slovic.txt', true)
        break;
      case 5:
        addTweak('19_speedo-turkish.txt', true)
        break;
      case 6:
        addTweak('19_speedo-french.txt', true)
        break;
      case 7:
        addTweak('19_speedo-italian.txt', true)
        break;
      case 8:
        addTweak('19_speedo-dutch.txt', true)
        break;
      default:
        addTweak('19_speedo-english.txt', true)
    }
    if (user.speedoOps.xph.id === 10) {
      addTweak('19_speedo-mph.txt', true)
    }
    if (user.speedoOps.effic.id === 40) {
      addTweak('19_speedo-kml.txt', true)
    }
    if (user.speedoOps.classicLargeText) {
      addTweak('19_speedo-lrgtxt.txt', true)
    }
    if (user.speedoOps.temperature.id === 43) {
      addTweak('19_speedo-temp.txt', true)
    }
    if (user.speedoOps.modAlt) {
      addTweak('19_speedo-analog.txt', true)
    }
    if (user.speedoOps.simpmod) {
      addTweak('19_speedo_bar.txt', true)
    }
    if (user.speedoOps.bg.id === 30) {
      addTweak('19_speedo-own_background.txt', true)
    } else if (user.speedoOps.bg.id === 31) {
      addTweak('19_speedo-old_background.txt', true)
    }
    if (user.speedoOps.sml.id === 22) {
      addTweak('19_speedo-small_speedo_off.txt', true)
    } else {
      if (user.speedoOps.sbmain !== undefined) {
        addTweak('19_set_sb_values.txt', true)
      }
      if (user.speedoOps.sbfuel !== 'disable') {
        addTweak('19_sbfuelbar.txt', true)
      }
      if (user.speedoOps.digiclock) {
        addTweak('19_speedo-digiclock.txt', true)
      }
      if (user.speedoOps.sbreverse) {
        addTweak('19_speedo-sbhiderev.txt', true)
      }
      if (!user.speedoOps.sbhideinapp) {
        addTweak('19_speedo-sbdonthide.txt', true)
      }
    }
    addTweak('19_speedo-i2.txt', true)
    addTweakDir('speedometer', true)
    writeSpeedoConfigFile(user)
  }
  if (user.options.includes(21)) {
    addTweak('08_orderflac-i.txt')
    addTweakDir('media-order-patching', true)
  }
  if (user.options.includes(24)) {
    addTweak('24_castscreen-i.txt')
    addTweakDir('castscreen-receiver', true)
  }
  if (user.options.includes(25)) {
    addTweak('25_androidauto-i.txt')
    addTweakDir('androidauto', true)
    if (user.aaWifi) {
      addTweak('25_androidautowifi-i.txt')
      addTweakDir('androidautowifi', true)
    }
    if (user.aaBetaVer) {
      addTweak('25_androidautob-i.txt')
      if (!user.aaWifi) addTweakDir('androidautob', true)
    }

  }
  if (user.options.includes(11)) {
    addTweak('11_msgreplies-i.txt')
    addTweakDir('message_replies', true)
  }
  if (user.options.includes(12)) {
    addTweak('12_diag-i.txt')
    addTweakDir('test_mode', true)
  }
  if (user.options.includes(13)) {
    addTweak('13_boot-i.txt')
    addTweakDir('bootanimation', true)
  }
  if (user.options.includes(26)) {
    addTweak('26_usbaudiomod-i.txt') // USB Audio Mod Install comes before Bigger Album Art
    addTweakDir('USBAudioMod', true)
  }
  if (user.options.includes(14)) {
    addTweak('14_bgart-i.txt')
    addTweakDir('bigger-album-art', true)
  }
  if (user.options.includes(15)) {
    addTweak('15_btnbackground-i.txt')
    addTweakDir('NoButtons', true)
  }
  if (user.options.includes(17)) {
    addTweak('17_videoplayer-i.txt')
    addTweakDir('videoplayer', true)
  }
  if (user.options.includes(27)) {
    addTweak('27_aioapp-i.txt')
    if (user.screenOffBoot) {
      addTweak('27_aioapp-screenoff.txt')
    }
    addTweakDir('aio-app', true)
  }
  if (user.mzdmeter.inst) {
    addTweak('28_mzdmeter-i.txt')
    addTweakDir('mzdmeter', true)
  }
  /*  TODO: Fuel Consumptoion Tweak - Think of a better way to pick MPG or Km/L (Like a variable) */
  if (user.options.includes(22)) {
    if (user.fuelOps === 1) {
      addTweak('22_fuelMPG-i.txt')
    } else {
      addTweak('22_fuel-i.txt')
    }
    addTweakDir('FuelConsumptionTweak', true)
  }
  // disclaimer & order of audio source list
  if (user.options.includes(2) || user.options.includes(9) || user.options.includes(102) || user.options.includes(109)) {
    addTweakDir('audio_order_AND_no_More_Disclaimer', true)
    buildEntList(user)
  }
  // Statusbar Tweaks
  if (user.options.includes(120)) {
    addTweak('20_date-u.txt')
    addTweakDir('date-to-statusbar_mod', false)
  } else if (user.options.includes(20)) {
    if (user.statusbar.d2sbuninst) {
      addTweak('20_date2status-u.txt')
      addTweakDir('date-to-statusbar_mod', false)
    } else if (user.statusbar.d2sbinst) {
      if (user.d2sbOps === 0) {
        addTweak('20_date-iv1.txt')
      } else {
        addTweak('20_date-iv3.3.txt')
      }
      addTweakDir('date-to-statusbar_mod', true)
    }
    if (user.statusbar.uninst) {
      addTweak('20_statusbar_tweaks-u.txt')
    } else {
      addTweak('20_statusbar_tweaks-i.txt')
    }
  }

  if (user.uistyle.uninst) {
    addTweak('20_uistyle-u.txt')
  } else if (user.mainOps.includes(9)) {
    addTweak('20_uistyle-i.txt')
  }
  if (user.uistyle.uninstmain) {
    addTweak('20_mainmenu-u.txt')
  } else if (user.mainOps.includes(8)) {
    addTweak('20_mainmenu-i.txt')
    addTweakDir('MainMenuTweaks', true)
  }
  if (user.options.includes(16)) {
    addTweak('16_blnkframe-i.txt')
  }
  // Off Screen Background
  if (user.mainOps.includes(10) || user.mainOps.includes(110)) {
    var inStrOff
    if (user.mainOps.includes(10)) {
      inStrOff = fs.createReadStream(`${varDir}/OffScreenBackground.png`)
      addTweak('00_offbackground-i.txt')
    } else {
      inStrOff = fs.createReadStream(path.resolve(app.getAppPath(), '../background-images/default/OffScreenBackground.png'))
      addTweak('00_offbackground-u.txt')
    }
    var outOff = fs.createWriteStream(`${tmpdir}/config/OffScreenBackground.png`, { flags: 'w' })
    outOff.on('close', function() {
      aioLog('Off Screen Background Copy Successful!')
    })
    inStrOff.pipe(outOff)
  }
  // Add chosen background
  if (user.mainOps.includes(2)) {
    if (user.mainOps.includes(6)) {
      addTweak('00_bgrotator-i.txt')
    }
    var inStrbg = fs.createReadStream(`${varDir}/background.png`)
    var out = fs.createWriteStream(`${tmpdir}/config/background.png`, { flags: 'w' })
    out.on('close', function() {
      aioLog('Background Copy Successful!')
    })
    inStrbg.pipe(out)
    addTweak('00_background.txt')
  }
  if (user.mainOps.includes(5)) {
    addTweak('00_sd-cid.txt')
    addTweakDir('get_sd_cid', true)
  }
  if (user.options.includes(19) || user.options.includes(17) || user.options.includes(25) || user.options.includes(27) || user.options.includes(28) || user.options.includes(119) || user.options.includes(117) || user.options.includes(125) || user.options.includes(127) || user.options.includes(128)) {
    addTweakDir('bin', true)
    if (user.options.includes(19) || user.options.includes(17) || user.options.includes(25) || user.options.includes(27) || user.options.includes(28)) {
      addTweakDir('jci', true)
      addTweak('00_59patch.txt')
    }
  }
  // Swapfile tweak has to be last because the final operation
  //  in the script is to remove all of the other tweak files
  if (user.options.includes(18)) {
    copySwapfile = true
    if (user.swapOps.mount) {
      swapdest = '/config/swapfile/'
      addTweak('18_swapfile-i.txt')
    } else {
      swapdest = '/'
    }
  }
  // Finish with the end script
  addTweak('00_end.txt')
  // Add root files to tmp and write tweaks.sh
  addRootFiles(user.dataDump)
  writeTweaksFile()
}
// function to add each tweak to the array
function addTweak(twk) {
  tweaks2write.push(`${builddir}${twk}`)
  twk = twk.substr(3)
  twk = twk.replace('.txt', '')
  twk = twk.replace('-i', ' Install ')
  twk = twk.replace('-u', ' Uninstall ')
  twk = twk.charAt(0).toUpperCase() + twk.slice(1)
  aioLog(`${twk} added successfully.`)
}

function writeTweaksFile() {
  // write stream writes tweaks.txt
  var tweaks = fs.createWriteStream(`${tmpdir}/tweaks.txt`)
  // file appender function is given the array and piped to the write stream
  new appender(tweaks2write).pipe(tweaks)
  tweaks.on('close', convert2LF)
}

function langVar(id) {
  switch (id) {
    case 0:
      return 'EN'
    case 1:
      return 'DE'
    case 2:
      return 'PL'
    case 3:
      return 'SL'
    case 4:
      return 'EN'
    case 5:
      return 'TK'
    case 6:
      return 'FR'
    case 7:
      return 'IT'
    case 8:
      return 'NL'
    default:
      return 'EN'
  }
}

function writeSpeedoConfigFile(user) {
  mkdirp.sync(`${tmpdir}/config/speedometer/jci/gui/apps/_speedometer/js/`)
  /*
  var spdStartup = `// speedometer-startup.js\n// Generated By AIO v${app.getVersion()}\n`
  spdStartup += `var enableSmallSbSpeedo = ${user.speedoOps.sml !== 22};\n`
  spdStartup += `var isMPH = ${user.speedoOps.xph == 11};\n`
  spdStartup += `var language = ''${langvar(user.speedoOps.language)}';\n`
  spdStartup += `var fuelEffunit_kml = ${user.speedoOps.fuelEffunit_kml};\n`
  spdStartup += `var black_background_opacity = ${user.speedoOps.black_background_opacity};\n`
  spdStartup += `var original_background_image = ${user.speedoOps.original_background_image};\n`
  spdStartup += `var startAnalog = ${user.speedoOps.startAnalog};\n`
  spdStartup += `var barSpeedometerMod = ${user.speedoOps.barSpeedometerMod};\n`
  spdStartup += `var speedMod = ${user.speedoOps.speedMod};\n`
  spdStartup += `var engineSpeedBar = ${user.speedoOps.engineSpeedBar};\n`
  spdStartup += `var hideSpeedBar = ${user.speedoOps.hideSpeedBar};\n`
  spdStartup += `var tempIsF = ${user.speedoOps.tempIsF};\n`
  spdStartup += `var speedAnimation = ${user.speedoOps.speedAnimation};\n`
  spdStartup += `var analogColor = ${user.speedoOps.analogColor};\n`
  spdStartup += `var speedometerTheme = ${user.speedoOps.speedometerTheme};\n`
  spdStartup += `var sbFuelBar = ${user.speedoOps.sbFuelBar};\n`
  spdStartup += `var sbfbPos = '${user.speedoOps.sbfbPos}';\n`
  spdStartup += `var SbMain = '${user.speedoOps.SbMain}';\n`
  spdStartup += `var SbVal1 = '${user.speedoOps.SbVal1}';\n`
  spdStartup += `var SbVal2 = '${user.speedoOps.SbVal2}';\n`
  fs.writeFileSync(`${varDir}/startupvars.js`, spdStartup)
  var config = fs.createWriteStream(`${tmpdir}/config/speedometer/jci/gui/apps/_speedometer/js/speedometer-startup.js`)
  new appender(speedoConfig).pipe(config)
  config.on('close', function() { console.log("speedometer-startup.js written successfully!") })
*/
  var JSobj = `var spdBottomRows = ${user.spdExtra.barSpeedoRows}; //Number of Bottom Rows\n`
  JSobj += 'var spdTbl = {\n'
  for (var val in user.spdValues) {
    //console.log(user.spdValues[val].pos);
    if (`${user.spdValues[val].pos}` !== null) {
      JSobj += `\t${user.spdValues[val].elmnt}: [${user.spdValues[val].pos}], //${user.spdValues[val].label}\n`
    }
  }
  JSobj += "}\n"
  JSobj += "var classicSpeedoTmplt = "
  JSobj += JSON.stringify(user.classicSpeed, null, '\t') + '\n'
  //console.log(JSobj)
  fs.writeFileSync(`${varDir}/spdConf.txt`, JSobj)
  var speedoConfig = []
  speedoConfig.push(`${builddir}/config/speedometer_config/config-start.js`)
  speedoConfig.push(`${varDir}/spdConf.txt`)
  speedoConfig.push(`${builddir}/config/speedometer_config/config-end.js`)

  var config = fs.createWriteStream(`${tmpdir}/config/speedometer/speedometer-config.js`)
  new appender(speedoConfig).pipe(config)
  config.on('close', function() {
    //console.log("speedometer-config.js written successfully!")
  })

  fs.writeFileSync(`${tmpdir}/config/speedometer/speedometer-controls.js`, `var spdBtn = ${JSON.stringify(user.multictrl,null,'\t')}`)
  for (bt in user.barThemeColors) {
    var num = user.barThemeColors[bt].num
    barColorFile += `/* Theme #${num} */\n`
    barColorFile += `#speedBarContainer.theme${num} #vehdataMainDiv fieldset div, #speedBarContainer.theme${num} #vehdataMainDiv [class*="vehDataMain"].pos0 div {\n`
    barColorFile += `\tcolor: ${user.barThemeColors[bt].main};\n}\n`
    barColorFile += `#speedBarContainer.theme${num} #vehdataMainDiv [class*="vehDataMain"].pos0 legend .spunit span, #speedBarContainer.theme${num} #vehdataMainDiv fieldset {\n`
    barColorFile += `\tcolor: ${user.barThemeColors[bt].secondary};\n`
    barColorFile += `\tborder-color: ${user.barThemeColors[bt].border};\n}\n`
  }

  //console.log(barColorFile)
  fs.writeFileSync(`${tmpdir}/config/speedometer/barThemes.css`, barColorFile)
}

function tweakVariables(user) {

  var bak = `KEEPBKUPS=` + (user.backups.org ? `1\n` : `0\n`)
  bak += `TESTBKUPS=` + (user.backups.test ? `1\n` : `0\n`)
  bak += `SKIPCONFIRM=` + (user.backups.skipconfirm ? `1\n` : `0\n`)
  bak += (user.mainOps.includes(1) ? `ZIPBACKUP=` + (user.zipbackup ? `1\n` : `0\n`) : '')
  bak += (user.mainOps.includes(4) ? `FORCESSH=` + (user.forcessh ? `1\n` : `0\n`) : '')
  fs.writeFileSync(`${varDir}/backups.txt`, bak)
  tweaks2write.push(`${varDir}/backups.txt`)

  if (user.restore.full) {
    bak = `DEL_BAKUPS=`
    bak += (user.restore.delBackups) ? `1\n` : `0\n`
    fs.writeFileSync(`${varDir}/restore.txt`, bak)
    tweaks2write.push(`${varDir}/restore.txt`)
  }

  if (user.mainOps.includes(6)) {
    tweaks2write.push(`${varDir}/bg-rotator.txt`)
  }
  if (user.mainOps.includes(3)) {
    switch (user.colors) {
      case 0:
        themeColor = 'Red'
        break
      case 1:
        themeColor = 'Blue'
        break
      case 2:
        themeColor = 'Green'
        break
      case 3:
        themeColor = 'Silver'
        break
      case 4:
        themeColor = 'Pink'
        break
      case 5:
        themeColor = 'Purple'
        break
      case 6:
        themeColor = 'Orange'
        break
      case 7:
        themeColor = 'Yellow'
        break
      case 8:
        themeColor = 'SmoothRed'
        break
      case 9:
        themeColor = 'SmoothAzure'
        break
      case 10:
        themeColor = 'SmoothViolet'
        break
      case 11:
        themeColor = 'CarOS'
        break
      case 12:
        themeColor = 'StormTroopers'
        break
      case 13:
        themeColor = 'Poker'
        break
      case 14:
        themeColor = 'Mazda'
        break
      case 15:
        themeColor = 'Floating'
        break
      case 16:
        themeColor = 'X-Men'
        break
      case 17:
        themeColor = 'Custom'
        break
      default:
        themeColor = 'Red'
    }
  }
  if (user.options.includes(13)) {
    var bootAnimations = `BOOTLOGO1=${user.boot.logo1}\n`
    bootAnimations += `BOOTLOGO2=${user.boot.logo2}\n`
    bootAnimations += `BOOTLOGO3=${user.boot.logo3}\n`
    fs.writeFileSync(`${varDir}/bootlogo.txt`, bootAnimations)
    tweaks2write.push(`${varDir}/bootlogo.txt`)
  }
  if (user.mainOps.includes(3)) {
    fs.writeFileSync(`${varDir}/color.txt`, `COLORTHEME=${themeColor}\n`)
    tweaks2write.push(`${varDir}/color.txt`)
  }
  if (user.options.includes(1)) {
    if (user.keepSpeedRestrict) {
      fs.writeFileSync(`${varDir}/touchscreen.txt`, `KEEP_SPEED_RESTRICT=1\n`)
    } else {
      fs.writeFileSync(`${varDir}/touchscreen.txt`, `KEEP_SPEED_RESTRICT=0\n`)
    }
    tweaks2write.push(`${varDir}/touchscreen.txt`)
  }
  if (user.mainOps.includes(8)) {
    var mmenu = `UI_STYLE_ELLIPSE=`
    mmenu += (user.uistyle.ellipse) ? `1\n` : `0\n`
    mmenu += `UI_STYLE_MINICOINS=`
    mmenu += (user.uistyle.minicoins) ? `1\n` : `0\n`
    mmenu += `UI_STYLE_MINIFOCUS=`
    mmenu += (user.uistyle.minifocus) ? `1\n` : `0\n`
    mmenu += `UI_STYLE_NOGLOW=`
    mmenu += (user.uistyle.hideglow) ? `1\n` : `0\n`
    mmenu += `UI_STYLE_ALTLAYOUT=${user.uistyle.layout}\n`
    mmenu += `UI_STYLE_MAIN3D=${user.uistyle.mainlabel}\n`
    mmenu += `UI_STYLE_LABELCOLOR=${user.uistyle.labelcolor}\n`
    fs.writeFileSync(`${varDir}/mainmenu.txt`, mmenu)
    tweaks2write.push(`${varDir}/mainmenu.txt`)
  }
  if (user.mainOps.includes(9)) {
    var ui = `UI_STYLE_BODY=${user.uistyle.body}\n`
    ui += `UI_STYLE_LIST=${user.uistyle.listitem}\n`
    ui += `UI_STYLE_DISABLED=${user.uistyle.listitemdisabled}\n`
    ui += `UI_STYLE_TITLE=${user.uistyle.title}\n`
    ui += `UI_STYLE_RADIO=${user.uistyle.radio}\n`
    ui += `UI_STYLE_SHADOW=`
    ui += (user.uistyle.shadow) ? `"text-shadow: 2px 2px .5px #000;"\n` : `\n`
    fs.writeFileSync(`${varDir}/uistyle.txt`, ui)
    tweaks2write.push(`${varDir}/uistyle.txt`)
  }
  if (user.options.includes(14)) {
    var noalbmart = `NOALBM=`
    noalbmart += (user.uistyle.noalbm) ? `1\n` : `0\n`
    noalbmart += `FULLTITLES=`
    noalbmart += (user.uistyle.fulltitles) ? `1\n` : `0\n`
    fs.writeFileSync(`${varDir}/bgralbmart.txt`, noalbmart)
    tweaks2write.push(`${varDir}/bgralbmart.txt`)
  }
  if (user.options.includes(15)) {
    var transbg = `NO_BTN_BG=`
    transbg += (user.uistyle.nobtnbg) ? `1\n` : `0\n`
    transbg += `NO_NP_BG=`
    transbg += (user.uistyle.nonpbg) ? `1\n` : `0\n`
    transbg += `NO_LIST_BG=`
    transbg += (user.uistyle.nolistbg) ? `1\n` : `0\n`
    transbg += `NO_CALL_BG=`
    transbg += (user.uistyle.nocallbg) ? `1\n` : `0\n`
    transbg += `NO_TEXT_BG=`
    transbg += (user.uistyle.notextbg) ? `1\n` : `0\n`
    fs.writeFileSync(`${varDir}/removebgs.txt`, transbg)
    tweaks2write.push(`${varDir}/removebgs.txt`)
  }
  if (user.options.includes(20)) {
    var dateFormat = user.d2sbOps - 1
    fs.writeFileSync(`${varDir}/d2sb.txt`, `DATE_FORMAT=${dateFormat}\n`)
    tweaks2write.push(`${varDir}/d2sb.txt`)
    var sc = `STATUS_BAR_APP=${user.statusbar.app}\n`
    sc += `STATUS_BAR_CLOCK=${user.statusbar.clock}\n`
    sc += `STATUS_BAR_NOTIF=${user.statusbar.notif}\n`
    sc += `STATUS_BAR_OPACITY=${user.statusbar.opacity}\n`
    sc += (user.statusbar.main) ? `STATUS_BAR_CTRL="background-image: none;"\nSBN_CTRL="background-image: none;"\n` : `STATUS_BAR_CTRL="background-image: url('../images/StatusBarBg.png');"\nSBN_CTRL=\n`
    fs.writeFileSync(`${varDir}/statusbar-color.txt`, sc)
    tweaks2write.push(`${varDir}/statusbar-color.txt`)
  }
  if (user.options.includes(19)) {
    var sops = `OPACITY=`
    sops += (user.speedoOps.bg.id === 30) ? `${user.speedoOps.opac}\n` : `0\n`
    sops += `SPEEDCOLOR=`
    sops += (user.speedoOps.color !== null) ? `${user.speedoOps.color}\n` : `0\n`
    sops += `SPD_BAR_RPM=`
    sops += (user.spdExtra.engineSpeedBar) ? `1\n` : `0\n`
    sops += `SPD_BAR_HIDE=`
    sops += (user.spdExtra.hideSpeedBar) ? `1\n` : `0\n`
    sops += `SPD_COUNTER=`
    sops += (user.spdExtra.speedAnimation) ? `1\n` : `0\n`
    sops += `HIDE_SPEEDO_SBN=`
    sops += (user.spdExtra.hidespeedosbn) ? `1\n` : `0\n`
    sops += `SPD_XTRA_FUEL_SUFF=${user.spdExtra.fuelGaugeValueSuffix}\n`
    sops += `SPD_XTRA_FUEL_FACT=${user.spdExtra.fuelGaugeFactor}\n`
    sops += (user.speedoOps.sbmain !== undefined) ? `SBMAIN=${user.speedoOps.sbmain}\n` : `\n`
    sops += (user.speedoOps.sbval1 !== undefined) ? `SBVAL1=${user.speedoOps.sbval1}\n` : `\n`
    sops += (user.speedoOps.sbval2 !== undefined) ? `SBVAL2=${user.speedoOps.sbval2}\n` : `\n`
    sops += (user.speedoOps.sbfuel !== undefined) ? `SBFBPOS=${user.speedoOps.sbfuel}\n` : `\n`
    sops += `SBUNIT=speedUnit\n`
    sops += `BTSTART=${user.spdExtra.barThemeStart}\n`
    sops += `SBINT=${user.speedoOps.sbint*1000}\n`
    for (fb in user.fuelBarColors) {
      sops += `${user.fuelBarColors[fb].bashVar}="${user.fuelBarColors[fb].colorVal}"\n`
      //console.log(`${user.fuelBarColors[fb].bashVar}="${user.fuelBarColors[fb].colorVal}"`);
    }
    fs.writeFileSync(`${varDir}/bgopacity.txt`, sops)
    tweaks2write.push(`${varDir}/bgopacity.txt`)

  }
  if (user.options.includes(26)) {
    fs.writeFileSync(`${varDir}/gracenote.txt`, `GRACENOTE="${user.gracenoteText}"`)
    tweaks2write.push(`${varDir}/gracenote.txt`)
  }
}

function convert2LF() {
  /* For now the files are pre converted, but this needs to stay in just in case EOL format changes.*********** */
  crlf.set(`${tmpdir}/tweaks.txt`, 'LF', function(err, endingType) {
    if (err) {
      aioLog(err, 'LF Convert Error')
    } else if (endingType === 'NA') {
      aioLog(`LF Convert Error`, `EOL => ${endingType} (Format should be: LF)`)
    } else if (endingType === 'LF') {
      aioLog(`EOL => ${endingType}`)
    } else {
      aioLog(`LF Convert Error`, `EOL => ${endingType} (Format should be: LF)`)
    }
    // Rename tweaks.txt to tweaks.sh
    fs.renameSync(`${tmpdir}/tweaks.txt`, `${tmpdir}/tweaks.sh`)
    aioLog('Writing Tweaks.sh')
    opsComplete = true
    setTimeout(function() {
      if (filesComplete) {
        printAIOlog()
      }
    }, 5000)
  })
}
// Function for copying tweak folders
function addTweakDir(twk, inst) {
  filesComplete = false
  aioLog(`Copying ${twk} files...`)
  fileCount++
  var twkdir = '/config/'
  if (!inst) {
    twkdir = '/config_org/'
    mkdirp.sync(`${tmpdir}/config_org/`)
  }
  try {
    if (!fs.existsSync(`${tmpdir}${twkdir}${twk}`)) {
      fs.mkdirSync(`${tmpdir}${twkdir}${twk}`)
    }
    // console.log(`${approot}/files/tweaks/${twkdir}${twk}`)
    // Above creates, below copies to tmp
    copydir(`${builddir}${twkdir}${twk}`, `${tmpdir}${twkdir}${twk}`, function(err) {
      if (err) {
        aioLog(`File Copy Error: ${twk}-${err}`, `${err}-${twk}`)
      } else {
        aioLog(`Files for ${twk} copied successfully!`)
      }
      fileCount--
      if (fileCount === 0) {
        setTimeout(function() {
          if (fileCount === 0) {
            filesComplete = true
          }
          if (opsComplete) {
            printAIOlog()
          }
        }, 5000)
      }
    })
  } catch (e) {
    aioLog(e, e)
  }
}
// Function copys root files
function addRootFiles(dataDump) {
  try {
    copydir(`${approot}/files/tweaks/root`, `${tmpdir}`, function(err) {
      if (err) {
        errFlag = true
        aioLog('ERROR COPYING ROOT FILES', err)
      } else {
        if (dataDump) {
          copydir(`${tmpdir}/data`, `${tmpdir}`, function(err) {
            if (err) { errFlag = true } else {
              rimraf.sync(`${tmpdir}/data`)
              aioLog('Root files copied successfully!')
            }
          })
        } else {
          rimraf.sync(`${tmpdir}/data`)
          aioLog('Root files copied successfully!')
        }
      }
    })
  } catch (e) {
    aioLog(e, e)
  }
}

function aioLog(logMsg, err) {
  if (err) {
    errFlag = true
    window.alert(err, 'MZD-AIO-TI ERROR')
    AIO_LOG_HTML += `<li style='font-weight:600;color:red'> ${logMsg}</li>\n`
    printAIOlog()
  } else if (keeplog) {
    AIO_LOG_HTML += `<li style='color:#004c00'> ${logMsg}</li>\n`
  }
  userView = document.getElementById(`userLogView`)
  if (userView) {
    userView.innerHTML = logMsg
  }
  if (keeplog) { //console.log(logMsg)
    AIO_LOG += `- ${logMsg}\n`
  }
}
// Prints out the log
function printAIOlog() {
  if (filesComplete && opsComplete || errFlag) {
    filesComplete = false
    opsComplete = false
    if (keeplog) {
      fs.writeFile(`${tmpdir}/${logFileName}.md`, AIO_LOG, { flag: 'w' }, (err) => {
        if (err) { console.log('AIO Could Not Be Saved') } else { console.log('AIO log saved!') }
        fs.writeFile(path.resolve(path.join(`${approot}`, `../../${logFileName}.htm`)), AIO_LOG_HTML, { flag: 'w' }, (err) => {
          if (err) { console.log('HTML Log Cannot Be Saved') } else { console.log('AIO log saved! (HTML version)') }
          bootbox.hideAll()
          if (!errFlag) {
            usbDrives()
          } else {
            finishedMessage()
          }
        })
      })
    } else {
      usbDrives()
    }
  }
}

function appendAIOlog(logMsg) {
  if (keeplog) {
    fs.writeFile(path.resolve(path.join(`${approot}`, `../../${logFileName}.htm`)), logMsg, { flag: 'a' }, (err) => {
      if (err) {
        console.log(err)
      } else {
        fs.writeFile(path.resolve(path.join(`${tmpdir}`, `${logFileName}.md`)), `- ${String(logMsg).replace(/<[^>]+>/gm, '')}`, { flag: 'a' }, (err) => {
          if (err) {
            console.log(`Log File has been moved: ${err}`)
          }
        })
      }
    })
  }
}
// Returns the available usb drives
function usbDrives() {
  var disks = []
  var usbDriveLst = []

  try {
    drivelist.list((error, dsklst) => {
      if (error) { throw error }
      dsklst.forEach((drive) => {
        if (!drive.isSystem) {
          disks.push({ 'desc': drive.description, 'mp': `${drive.mountpoints[0].path}` })
          usbDriveLst.push({ 'text': `<span class='icon-usb'></span> ${drive.mountpoints[0].path.replace('\\','')} ${drive.description.replace(' USB Device', '')}`, 'value': drive.mountpoints[0].path })
        }
      })

      introJs().hideHints()
      var usb = disks
      var lst = ''
      if (usb.length < 1) {
        appendAIOlog(`<li style='color:#520086'>No USB Drives Found</li>`)
        unzipSwapfile(null)
      } else if (usb.length > 1) {
        lst += `<h2><b>${usb.length} ${langObj.popupMsgs[6].msg}:</b></h2>`
        var usbuttons = ''
        for (var j = 0; j < usb.length; j++) {
          var mpLocation = (process.platform === 'win32') ? `${usb[j].mp.replace('\\', '/')}` : `${usb[j].mp}`
          lst += `<h4> ${mpLocation.replace('/','')} ${usb[j].desc} `
          lst += `<button class="w3-round w3-btn w3-ripple w3-hover-indigo w3-border w3-hover-border-pink w3-large" title='${langObj.popupMsgs[5].msg} ${mpLocation.replace(':/','')}' onclick="shell.showItemInFolder('${mpLocation}')"></span><span class="icon-usb2"></span> ${langObj.popupMsgs[5].msg} ${mpLocation.replace(':/','')}</button></h4>`
          appendAIOlog(`<li style='color:#005182'>Found USB Drive #${j + 1} - ${mpLocation.replace(':/','')} ${usb[j].desc}</li>`)
        }
        lst += `<h5><b>${langObj.popupMsgs[8].msg}:</b></h5>${langObj.popupMsgs[2].msg}`
        lst += usbuttons
        lst += `<label class="delCopyMultiLabel w3-display-bottomleft"><input type="checkbox" class="w3-check" id="rmCpDirCheck">${langObj.popupMsgs[21].msg}</label>`
        bootbox.prompt({
          title: lst,
          inputType: 'select',
          inputOptions: usbDriveLst,
          className: 'copytoUSBMulti',
          buttons: {
            confirm: {
              label: `<span class='icon-usb'></span> ${langObj.popupMsgs[3].msg}`
            },
            cancel: {
              label: `<span class='icon-x'></span> ${langObj.popupMsgs[4].msg}`
            }
          },
          callback: function(result) {
            if (!result) {
              unzipSwapfile(null)
            } else {
              settings.set('delCopyFolder', $('#rmCpDirCheck').prop('checked'))
              copyToUSB(result)
            }
          }
        })
        $('#rmCpDirCheck').prop('checked', settings.get('delCopyFolder'))
      } else if (usb.length === 1) {
        lst = `<h2><b>${langObj.popupMsgs[6].msg}: </b></h2>`
        for (var k = 0; k < usb.length; k++) {
          lst += `<h4><b>${usb[k].mp.replace('\\', '')} ${usb[k].desc}</b></h4>`
          appendAIOlog(`<li style='color:#005182'>USB Drive - ${usb[k].mp.replace('\\', '')} ${usb[k].desc}</li>`)
        }
        var mpLocation = (process.platform === 'win32') ? `${usb[0].mp.replace('\\', '/')}` : `${usb[0].mp}`
        lst += `<b>${langObj.popupMsgs[7].msg} ${mpLocation.replace('/', '')}?</b><br>${langObj.popupMsgs[2].msg}`
        lst += `<button class="w3-large w3-blue-grey w3-btn w3-ripple w3-hover-teal w3-border w3-border-orange w3-large w3-display-bottomleft" style="margin-bottom: -55px;margin-left: 10px;" title='${langObj.popupMsgs[5].msg}' onclick="shell.showItemInFolder('${mpLocation}')"></span><span class="icon-usb3"></span> ${langObj.popupMsgs[5].msg}</button>`
        lst += `<label class="delCopyLabel w3-display-bottomright"><input type="checkbox" id="rmCpDirCheck" class="w3-check">${langObj.popupMsgs[21].msg}</label>`
        bootbox.confirm({
          title: `Copy files to USB drive?`,
          message: lst,
          className: 'copytoUSB1',
          buttons: {
            confirm: {
              label: `<span class='icon-usb'></span> ${langObj.popupMsgs[3].msg}`
            },
            cancel: {
              label: `<span class='icon-x'></span> ${langObj.popupMsgs[4].msg}`
            }
          },
          callback: function(result) {
            if (!result) {
              unzipSwapfile(null)
            } else {
              settings.set('delCopyFolder', $('#rmCpDirCheck').prop('checked'))
              copyToUSB(mpLocation)
            }
          }
        })
        $('#rmCpDirCheck').prop('checked', settings.get('delCopyFolder'))
        return usb
      }
    })
  } catch (e) {
    bootbox.alert({
      title: '<center>Error Locating Available USB Drives</center>',
      message: `<div>${e.toString()}</div><div class="w3-center w3-large"><h2>Build has completed successfully</h2>Although USB drives cannot be found because of an error.<br>${langObj.popupMsgs[9].msg} <pre>${tmpdir}</pre> ${langObj.popupMsgs[10].msg}. <br><button href='' class='w3-large w3-center w3-black w3-btn w3-ripple nousbbutton' title='Copy These Files To A Blank USB Drive' onclick='openCopyFolder()'>${langObj.menu.copytousb.toolTip}</button></div> `,
      callback: function() {
        bootbox.hideAll()
        unzipSwapfile(null)
      }
    })
    appendAIOlog(e)
  }
}

function noUsbDrive() {
  bootbox.hideAll()
  bootbox.alert({
    title: `<h2>Compilation Finished!</h2>`,
    className: `compFinishBox`,
    message: `${langObj.popupMsgs[9].msg} <pre>${tmpdir}</pre> ${langObj.popupMsgs[10].msg}. <br><button href='' class='w3-large w3-center w3-black w3-btn w3-ripple nousbbutton' title='Copy These Files To A Blank USB Drive' onclick='openCopyFolder()'>${langObj.menu.copytousb.toolTip}</button>`,
    callback: function() { finishedMessage() }
  })
  appendAIOlog(`<li style='color:#4a0dab'>To Install Tweak Files: Copy Entire Contents of "_copy_to_usb" Onto USB Drive.</li><li style='color:#1a0dab'>Location:<a href='' onclick='openCopyFolder()'><u> ${tmpdir}</u></a></li>`)
}

function copyToUSB(mp) {
  var copyingUSB = bootbox.dialog({
    message: `<div class='w3-center'><h3>${langObj.popupMsgs[11].msg} ${mp.replace(':\\','')}...  ${langObj.popupMsgs[12].msg}...</h3><br><div id='userLogView' style='text-align:center;' ></div><br><img class='loader' src='./files/img/load-0.gif' alt='...' /></div>`,
    className: 'copyingtoUSB',
    closeButton: false
  })
  if (!keeplog) {
    mp = `${mp}/XX`
    mkdirp.sync(mp)
  }
  try {
    copydir(tmpdir, mp, function(err) {
      if (err) {
        showNotification('Error Copying Files to USB', 'Unable to copy files to USB drive', 13)
        window.alert(err, 'Error: Unable to copy files to USB drive')
        appendAIOlog(`<li style='color:#ff0000'>${err} Unable To Copy Files To USB Drive</li>`)
        errFlag = true
        finishedMessage()
      } else {
        appendAIOlog(`<li style='color:#002200;font-weight:800;'>Files Copied to USB Drive ${mp.replace(':', '')}.</li>`)
        copyingUSB.hide()
        unzipSwapfile(mp)
      }
    })
  } catch (error) {
    bootbox.hideAll()
    window.alert(`${error}Copying to USB error`)
    appendAIOlog(`<li style='color:#ff0000'>${err} Unable To Copy Files To USB Drive</li>`)
  }
}

function unzipSwapfile(dest) {
  var nocopy = false
  if (!dest) {
    nocopy = true
    dest = `${tmpdir}`
  }
  dest = `${dest}${swapdest}`
  if (copySwapfile) {
    copySwapfile = false
    appendAIOlog(`<li style='color:#005182'>${langObj.popupMsgs[13].msg}: ${dest.replace(':\\', '')}</li>`)
    var swapMsg = bootbox.dialog({
      message: `<div class='w3-center'><h3>${langObj.popupMsgs[13].msg}: ${dest.replace(':\\', '')}...  ${langObj.popupMsgs[12].msg}... </h3><br><div id='swapLogView' style='text-align:center;' ></div><br><img class='loader' src='./files/img/load-0.gif' alt='...' /></div>`,
      closeButton: false
    })
    setTimeout(function() {
      if (document.getElementById('swapLogView')) {
        document.getElementById('swapLogView').innerHTML += `\n\n${langObj.popupMsgs[14].msg}`
      }
    }, 10000)
    setTimeout(function() {
      if (document.getElementById('swapLogView')) {
        document.getElementById('swapLogView').innerHTML += `\n\n${langObj.popupMsgs[15].msg}`
      }
    }, 35000)
    setTimeout(function() {
      if (document.getElementById('swapLogView')) {
        document.getElementById('swapLogView').innerHTML = `${langObj.popupMsgs[16].msg}:<br>${langObj.tweakOps[19].toolTip}`
      }
    }, 40000)
    try {
      fs.mkdirSync(`${dest}`)
    } catch (e) {
      appendAIOlog(`<li style='color:#ff0000'>${e} Swapfile Already Exists, Overwriting...</li>`)
    }
    extract(`${approot}/files/tweaks/config/swapfile/swapfile.zip`, { dir: `${dest}` }, function(err) {
      if (err) {
        appendAIOlog(`<li style='color:#ff0000'>${err} Swapfile Error</li>`)
        console.error(err, err)
      }
      appendAIOlog(`<li style='color:#005182'>Swapfile Unzipped.</li>`)
      swapMsg.modal('hide')
      if (nocopy) {
        noUsbDrive()
      } else {
        finishedMessage(dest)
      }
    })
  } else {
    if (nocopy) {
      noUsbDrive()
    } else {
      finishedMessage(dest)
    }
  }
}
var strtOver = `<button id="startOver" class="w3-round-large w3-btn w3-ripple w3-large w3-hover-white w3-border w3-border-white w3-hover-border-black" onclick="location.reload()" autofocus><span class="icon-space-shuttle"></span>     ${langObj.popupMsgs[17].msg}</button>`
var viewLog = `<button class="w3-round-large w3-indigo w3-btn w3-ripple w3-hover-cyan w3-large w3-border w3-border-black view-log" title='Compile Log' onclick="$('#opn-mzd-log').click()"><span class='icon-star-full'></span>   ${langObj.popupMsgs[18].msg}</button>`
var closeApp = `<button class="w3-round-large w3-red w3-btn w3-ripple w3-hover-lime w3-large w3-border w3-border-purple" title="Close The App" onclick="window.close()"><span class="icon-exit"></span>    ${langObj.popupMsgs[19].msg}</button>`
var cp2usb = `<button class="w3-round-large w3-teal w3-btn w3-ripple w3-hover-pink w3-large w3-border w3-border-indigo" style="letter-spacing:1px" title="Copy These Files To A Blank USB Drive" onclick="openCopyFolder()"><span class="icon-copy2"></span> ${langObj.menu.copytousb.toolTip}</button>`
var saveBtn = `<button class="w3-round-large w3-purple w3-btn w3-ripple w3-hover-deep-orange w3-large w3-border w3-border-green" style="letter-spacing:.81px" title="Save Options" onclick="$('#save-btn').click()"><span class="icon-floppy-disk"></span> ${langObj.menu.save.toolTip}</button>`
var openUSB = ''

function finishedMessage(mp) {
  // Finished message
  if (mp) {
    if (settings.get('delCopyFolder')) {
      cleanCopyDir()
      cp2usb = ''
    }
    openUSB = `<h3><button class="w3-round-large w3-amber w3-btn w3-ripple w3-hover-blue w3-large w3-border w3-border-pink" title='${langObj.popupMsgs[5].msg}' onclick="shell.showItemInFolder('${process.platform === 'win32' ? mp.replace('\\','/'): mp}')"></span><span class="icon-usb3"></span>${langObj.popupMsgs[5].msg}</button></h3>`
  }
  bootbox.hideAll()
  if (errFlag) {
    bootbox.dialog({
      message: `<div class="errMessage w3-center"><span class="w3-closebtn" onclick="location.reload()">&times;</span><h2>An Error Has Occured.  Please Try Again.</h2><br /><h3>${strtOver}</h3><h3>${saveBtn}</h3><h3>${viewLog}</h3></div>`,
      className: 'finishedMessage',
      closeButton: false
    })
  } else {
    setTimeout(function() {
      var finalbox = bootbox.dialog({
        message: `<span class="w3-closebtn" onclick="postInstallTitle()">&times;</span><div class="w3-center w3-container w3-blue-grey" style="line-height:1.5;"><h1><small class="icon-bolt3"></small> ${langObj.popupMsgs[20].msg} <small class="icon-magic-wand"></small></h1><h3>${strtOver}</h3><h3>${viewLog}</h3><h3>${openUSB}</h3><h3>${cp2usb}</h3><h3>${saveBtn}</h3><h3>${closeApp}</h3></div>`,
        className: 'finishedMessage',
        closeButton: false
      })
      finalbox.on('shown.bs.modal', function() {
        $("#startOver").focus();
      })
    }, 100)
  }
  setTimeout(function() {
    appendAIOlog(`<li style='color:#000000;font-weight:800;'><em>Finished!</em></li></ul></div>`)
  }, 5000)
}

function postInstallTitle() {
  bootbox.hideAll()
  $('.twkfltr').hide()
  document.getElementById(`mzd-title`).innerHTML = `${viewLog}${document.getElementById('mzd-title').innerHTML}${strtOver}`
}

function saveInstallerOps(user) {
  settings.set('keepBackups', user.backups.org)
  settings.set('testBackups', user.backups.test)
  settings.set('skipConfirm', user.backups.skipconfirm)
}

function cleanCopyDir() {
  rimraf(`${tmpdir}`, function() { appendAIOlog(`<li style='color:#ff3366'>Deleted '_copy_to_usb' Folder</li>`) })
}

function casdkAppOptions(apps, inst) {
  var casdkapps = `APPSIMPLEDASHBOARD=`
  casdkapps += (apps.simpledashboard) ? `1\n` : `0\n`
  casdkapps += `APPGPSSPEED=`
  casdkapps += (apps.gpsspeed) ? `1\n` : `0\n`
  casdkapps += `APPMULTIDASH=`
  casdkapps += (apps.multidash) ? `1\n` : `0\n`
  casdkapps += `APPVDD=`
  casdkapps += (apps.vdd) ? `1\n` : `0\n`
  casdkapps += `APPDEVTOOLS=`
  casdkapps += (apps.devtools) ? `1\n` : `0\n`
  casdkapps += `APPTERMINAL=`
  casdkapps += (apps.terminal) ? `1\n` : `0\n`
  casdkapps += `APPBG=`
  casdkapps += (apps.background) ? `1\n` : `0\n`
  casdkapps += `APPTETRIS=`
  casdkapps += (apps.tetris) ? `1\n` : `0\n`
  casdkapps += `APPBREAKOUT=`
  casdkapps += (apps.breakout) ? `1\n` : `0\n`
  casdkapps += `APPSNAKE=`
  casdkapps += (apps.snake) ? `1\n` : `0\n`
  casdkapps += `APPCLOCK=`
  casdkapps += (apps.clock) ? `1\n` : `0\n`
  casdkapps += `APPSIMPLESPEEDO=`
  casdkapps += (apps.simplespeedo) ? `1\n` : `0\n`
  casdkapps += `CASDK_SD=`
  casdkapps += (apps.sdcard) ? `1\n` : `0\n`
  if (inst) {
    addCASDKapp(apps.simpledashboard, "simpledashboard")
    addCASDKapp(apps.gpsspeed, "gpsspeed")
    addCASDKapp(apps.multidash, "multidash")
    addCASDKapp(apps.vdd, "vdd")
    addCASDKapp(apps.devtools, "devtools")
    addCASDKapp(apps.terminal, "terminal")
    addCASDKapp(apps.background, "background")
    addCASDKapp(apps.tetris, "tetris")
    addCASDKapp(apps.breakout, "breakout")
    addCASDKapp(apps.snake, "snake")
    addCASDKapp(apps.clock, "clock")
    addCASDKapp(apps.simplespeedo, "simplespeedo")
  }
  fs.writeFileSync(`${varDir}/casdkapps.txt`, casdkapps)
  tweaks2write.push(`${varDir}/casdkapps.txt`)
}

function addCASDKapp(add, app) {
  if (add) {
    copydir(`${builddir}casdk/apps/app.${app}`, `${tmpdir}/casdk/apps/app.${app}`, function(err) {
      if (err) {
        aioLog(`File Copy Error: ${err}`, err.message)
        return
      }
      aioLog(`Files for CASDK copied successfully!`)
    })
  }
}

function buildCASDK(user, apps) {
  addRootFiles()
  casdkAppOptions(apps, user.casdk.inst)
  if (user.casdk.inst) {
    mkdirp.sync(`${tmpdir}/casdk/`)
    if (!user.casdkAppsOnly) {
      tweaks2write.push(`${builddir}00__casdk-i.txt`)
      if (user.casdk.region === 'eu') {
        fs.writeFileSync(`${varDir}/casdkreg.txt`, `sed -i "s/'na'/'eu'/g" /jci/gui/apps/custom/runtime/runtime.js && log_message "===                      Region Changed to EU                         ==="`)
      } else {
        fs.writeFileSync(`${varDir}/casdkreg.txt`, `sed -i "s/'eu'/'na'/g" /jci/gui/apps/custom/runtime/runtime.js && log_message "===                      Region Changed to NA                         ==="`)
      }
      tweaks2write.push(`${varDir}/casdkreg.txt`)
    }
    tweaks2write.push(`${builddir}00__casdkapps-i.txt`)
    copydir(`${builddir}casdk`, `${tmpdir}/casdk`, function(stat, filepath, filename) {
      if (filepath.includes(`apps`)) {
        return false
      }
      return true;
    }, function(err) {
      if (err) {
        aioLog(`File Copy Error: ${err}`, err.message)
        return
      }
      aioLog(`Files for CASDK copied successfully!`)
    })
  } else if (user.casdk.uninst) {
    tweaks2write.push(user.casdkAppsOnly ? `${builddir}00__casdkapps-u.txt` : `${builddir}00__casdk-u.txt`)
  } else {
    errFlag = true
    finishedMessage()
    return
  }
  writeTweaksFile()
}

function fullSystemRestore(user) {
  addRootFiles()
  tweaks2write.push(`${builddir}00___fullRestore.sh`)
  if (fs.existsSync(`${extradir}/color-schemes/Red/jci.zip`)) {
    mkdirp.sync(`${tmpdir}/config/color-schemes/Red`)
    aioLog(`Unzipping Red color theme folder`)
    extract(`${extradir}/color-schemes/Red/jci.zip`, { dir: `${tmpdir}/config/color-schemes/Red` }, function(err) {
      if (err) { aioLog(err) }
      aioLog(`Red Color Scheme Added Successfully`)
    })
  }
  copydir(`${builddir}config_org`, `${tmpdir}/config_org`, function(err) {
    if (err) {
      aioLog(`File Copy Error: ${err}`, err.message)
      return
    }
    aioLog(`Uninstall files copied successfully!`)
  })
  writeTweaksFile()
}

function buildAutorunInstaller(user) {
  if (user.autorun.serial) {
    tmpdir = `${tmpdir}/XX`
    mkdirp.sync(`${tmpdir}`)
  }
  copydir(`${approot}/files/tweaks/cmu-autorun/installer`, `${tmpdir}`, function(err) {
    if (err) {
      errFlag = true
      aioLog('ERROR COPYING AUTORUN FILES', err)
    } else {
      if (user.autorun.id7recovery) {
        copydir(`${approot}/files/tweaks/cmu-autorun/sdcard/recovery`, `${tmpdir}`, function(err) {
          if (err) {
            errFlag = true
            aioLog('ERROR COPYING ID7RECOVERY FILES', err)
          } else {
            rimraf.sync(`${tmpdir}/**/*.md`)
            rimraf.sync(`${tmpdir}/00-*/*.txt`)
            if (!user.autorun.serial) {
              fs.unlinkSync(`${tmpdir}/run.sh`)
            }
            aioLog('ID7_recovery Pack Copied Successfully!')
            addWifiApp(user)
          }
        })
      } else {
        aioLog('Autorun Installer/Uninstaller Copied Successfully!')
        addWifiApp(user)
      }
    }
  })
}

function addWifiApp(user) {
  filesComplete = true
  opsComplete = true
  if (user.autorun.autoADB || user.autorun.autoWIFI) {
    copydir(`${approot}/files/tweaks/cmu-autorun/sdcard/recovery-extra`, `${tmpdir}`, function(err) {
      if (err) {
        errFlag = true
        aioLog('ERROR COPYING AUTORUN FILES', err)
      }
      if (!user.autorun.autoADB) {
        rimraf.sync(`${tmpdir}/00-start-adb/`)
        rimraf.sync(`${tmpdir}/adb`)
      }
      if (!user.autorun.autoWIFI) {
        rimraf.sync(`${tmpdir}/00-start-wifiAP/`)
      }
    })
  }
  if (user.autorun.dryrun && !user.autorun.serial) {
    copydir(`${approot}/files/tweaks/cmu-autorun/sdcard/dryrun`, `${tmpdir}`, function(err) {
      if (err) { errFlag = true }
    })
  }
  if (user.autorun.autoWIFI) {
    bootbox.hideAll()
    var wificonfig = "# This is your wifiAP.config file\nexport NETWORK_WIFI_SSID=YourSSID\nexport NETWORK_WIFI_PASSWORD=YourSSIDpassword\n"
    bootbox.prompt({
      title: "You <b>MUST REPLACE THE VALUES</b> <em>'YourSSID'</em> and <em>'YourSSIDPassword'</em> with <b>your own values</b> to run the WiFi AP!",
      inputType: 'textarea',
      className: 'wifiSSIDprompt',
      value: wificonfig,
      callback: function(result) {
        //console.log(result)
        if (result === null || result === wificonfig) {
          bootbox.alert({
            size: "small",
            title: "Values Were Not Changed",
            message: "WiFi AP Will not be installed",
            callback: function() {
              rimraf.sync(`${tmpdir}/00-start-wifiAP/`)
              serialCheck(user)
            }
          })
        } else {
          fs.writeFileSync(`${tmpdir}/00-start-wifiAP/wifiAP.config`, result + '\n')
          serialCheck(user)
        }
      }
    })
  } else {
    serialCheck(user)
  }
}

function serialCheck(user) {
  if (user.autorun.serial) {
    try {
      fs.unlinkSync(`${tmpdir}/jci-autoupdate`)
      rimraf.sync(`${tmpdir}/*.temp`)
      rimraf.sync(`${tmpdir}/*.txt`)
      rimraf.sync(`${tmpdir}/*.md`)
      rimraf.sync(`${tmpdir}/*.up`)
      rimraf.sync(`${tmpdir}/*.sh`)
    } catch (e) {
      let m = `${e} - An Error Occured.`
      aioLog(m, m)
      finishedMessage()
      return
    }
  }
  printAIOlog()
}
