/**
 * parsers.js
 * This file defined a main class, Parser and any number
 * of derived classes, with certain functionality to extract
 * music from a given radio station
 */

import xmlParser from 'xml2js';
import EventEmitter from 'events';
import _ from 'underscore';
import _s from 'underscore.string';
import { getLastStationSong } from './database';
import { getCurrentData } from './externalData';
import logger from './logger';

class Parser extends EventEmitter {
  constructor() {
    super();
    this.link = null;
    this.shortName = null; // should be unique
    this.longName = null; // Name as it would normally appear
    this.json = null;
    this.lastSong = null;
    this.interval = null;
  }

  async startListening() {
    this.lastSong = await getLastStationSong(this.shortName);
    const attemptToUpdate = () => {
      try {
        this.updateCurrentSong();
      } catch (e) {
        logger.write(e.message);
      }
    };
    attemptToUpdate();
    this.interval = setInterval(() => {
      attemptToUpdate();
    }, 1000);
  }

  stopListening() {
    if (this.interval !== null) {
      clearInterval(this.interval);
    }
  }

  checkIfNewSong(currentSong) {
    if (!_.isEqual(currentSong, this.lastSong)) {
      this.lastSong = currentSong;
      const song = { ...currentSong };
      const { shortName, longName } = this;
      song.station = { shortName, longName };
      this.emit('new song', song);
    }
  }

  /**
   * Should get raw data from radio source and then save it to JSON
   */

  // eslint-disable-next-line class-methods-use-this
  setJson() {
    throw new Error('getJson has not been implemented');
  }

  /**
   * Should get the current song and then call checkIfNewSong
   */

  // eslint-disable-next-line class-methods-use-this
  updateCurrentSong() {
    throw new Error('updateCurrentSong has not been implemented');
  }
}

class KvfParser extends Parser {
  constructor() {
    super();
    this.link = 'http://kvf.fo/service/now-next.xml';
    this.shortName = 'kvf';
    this.longName = 'Kringvarp Føroya';
  }

  async setJson() {
    const xml = await getCurrentData(this.link);
    xmlParser.parseString(xml, (e, result) => {
      if (e) {
        logger.write(e.message);
        return;
      }
      this.json = result;
    });
  }

  async updateCurrentSong() {
    await this.setJson();
    const { artist, title } = this.json.data.now[0];
    if (artist[0] === '' || title[0] === '') {
      return null;
    } else if (_s.contains(title[0], 'Høvuðstíðindi') || _s.contains(title[0], 'GMF')) { // Manual exceptions
      logger.write(`Blacklisted song playing on KVF: ${title[0]}`);
      return null;
    }
    const currentSong = {
      artist: artist[0],
      title: title[0],
    };
    this.checkIfNewSong(currentSong);
    return currentSong;
  }
}

export default [
  KvfParser,
];
