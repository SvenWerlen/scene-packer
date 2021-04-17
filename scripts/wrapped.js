import {libWrapper} from './shim.js';

/**
 * Utilise libWrapper to ensure we get a sourceId for each of our compendium imports
 */
Hooks.once('setup', function () {
    // Only need to patch the sourceId in versions < 0.8.0
    if (!isNewerVersion(game.data.version, '0.7.9')) {
      libWrapper.register(
        'scene-packer',
        'EntityCollection.prototype.importFromCollection',
        async function (wrapped, ...args) {
          // const [ collection, entryId, updateData, options ] = args;

          const entName = this.object.entity;
          const pack = game.packs.get(args[0]);
          if (pack.metadata.entity !== entName) {
            return wrapped.bind(this)(...args);
          }

          // Sometimes the updateData argument isn't set
          if (!args[2]) {
            args[2] = {};
          }
          // Set the source uuid of the entity if it isn't already set in updateData
          if (!args[2]['flags.core.sourceId']) {
            const source = await pack.getEntity(args[1]);
            args[2]['flags.core.sourceId'] = source.uuid;
          }

          return wrapped.bind(this)(...args);
        },
        'WRAPPER',
      );

      libWrapper.register(
        'scene-packer',
        'Compendium.prototype.importAll',
        async function ({folderId = null, folderName = ''} = {}) {
          // Need to specify the sourceId, so copied and modified from foundry.js

          // Step 1 - optionally, create a folder
          if (FOLDER_ENTITY_TYPES.includes(this.entity)) {
            const f = folderId ? game.folders.get(folderId, {strict: true}) : await Folder.create({
              name: folderName || this.metadata.label,
              type: this.entity,
              parent: null,
            });
            folderId = f.id;
            folderName = f.name;
          }

          // Step 2 - load all content
          const entities = await this.getContent();
          ui.notifications.info(game.i18n.format('COMPENDIUM.ImportAllStart', {
            number: entities.length,
            type: this.entity,
            folder: folderName,
          }));

          // Step 3 - import all content
          const created = await this.cls.create(entities.map(e => {
            e.data['flags.core.sourceId'] = e.uuid; // Modified from original source
            e.data.folder = folderId;
            return e.data;
          }));
          ui.notifications.info(game.i18n.format('COMPENDIUM.ImportAllFinish', {
            number: entities.length, // Modified from original source
            type: this.entity,
            folder: folderName,
          }));
          return created;
        },
        'OVERRIDE',
      );
    }
  },
);