import {test} from '../../util/test.js';
import Camera from '../../../src/ui/camera.js';
import {FreeCameraOptions} from '../../../src/ui/free_camera.js';
import Transform from '../../../src/geo/transform.js';
import TaskQueue from '../../../src/util/task_queue.js';
import browser from '../../../src/util/browser.js';
import {fixedLngLat, fixedNum, fixedVec3} from '../../util/fixed.js';
import {equalWithPrecision} from '../../util/index.js';
import MercatorCoordinate from '../../../src/geo/mercator_coordinate.js';
import LngLat from '../../../src/geo/lng_lat.js';
import {vec3, quat} from 'gl-matrix';

test('camera', (t) => {
    function attachSimulateFrame(camera) {
        const queue = new TaskQueue();
        camera._requestRenderFrame = (cb) => queue.add(cb);
        camera._cancelRenderFrame = (id) => queue.remove(id);
        camera.simulateFrame = () => queue.run();
        return camera;
    }

    function createCamera(options) {
        options = options || {};

        const transform = new Transform(0, 20, 0, 85, options.renderWorldCopies, options.projection);
        transform.resize(512, 512);

        const camera = attachSimulateFrame(new Camera(transform, {}))
            .jumpTo(options);

        camera._update = () => {};
        camera._preloadTiles = () => {};

        return camera;
    }

    function assertTransitionTime(test, camera, min, max) {
        let startTime;
        camera
            .on('movestart', () => { startTime = new Date(); })
            .on('moveend', () => {
                const endTime = new Date();
                const timeDiff = endTime - startTime;
                test.ok(timeDiff >= min && timeDiff < max, `Camera transition time exceeded expected range( [${min},${max}) ) :${timeDiff}`);
                test.end();
            });
    }

    t.test('#jumpTo', (t) => {
        // Choose initial zoom to avoid center being constrained by mercator latitude limits.
        const camera = createCamera({zoom: 1});

        t.test('sets center', (t) => {
            camera.jumpTo({center: [1, 2]});
            t.deepEqual(camera.getCenter(), {lng: 1, lat: 2});
            t.end();
        });

        t.test('throws on invalid center argument', (t) => {
            t.throws(() => {
                camera.jumpTo({center: 1});
            }, Error, 'throws with non-LngLatLike argument');
            t.end();
        });

        t.test('keeps current center if not specified', (t) => {
            camera.jumpTo({});
            t.deepEqual(camera.getCenter(), {lng: 1, lat: 2});
            t.end();
        });

        t.test('sets zoom', (t) => {
            camera.jumpTo({zoom: 3});
            t.deepEqual(camera.getZoom(), 3);
            t.end();
        });

        t.test('keeps current zoom if not specified', (t) => {
            camera.jumpTo({});
            t.deepEqual(camera.getZoom(), 3);
            t.end();
        });

        t.test('sets bearing', (t) => {
            camera.jumpTo({bearing: 4});
            t.deepEqual(camera.getBearing(), 4);
            t.end();
        });

        t.test('keeps current bearing if not specified', (t) => {
            camera.jumpTo({});
            t.deepEqual(camera.getBearing(), 4);
            t.end();
        });

        t.test('sets pitch', (t) => {
            camera.jumpTo({pitch: 45});
            t.deepEqual(camera.getPitch(), 45);
            t.end();
        });

        t.test('keeps current pitch if not specified', (t) => {
            camera.jumpTo({});
            t.deepEqual(camera.getPitch(), 45);
            t.end();
        });

        t.test('sets multiple properties', (t) => {
            camera.jumpTo({
                center: [10, 20],
                zoom: 10,
                bearing: 180,
                pitch: 60
            });
            t.deepEqual(camera.getCenter(), {lng: 10, lat: 20});
            t.deepEqual(camera.getZoom(), 10);
            t.deepEqual(camera.getBearing(), 180);
            t.deepEqual(camera.getPitch(), 60);
            t.end();
        });

        t.test('emits move events, preserving eventData', (t) => {
            let started, moved, ended;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { ended = d.data; });

            camera.jumpTo({center: [1, 2]}, eventData);
            t.equal(started, 'ok');
            t.equal(moved, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('emits zoom events, preserving eventData', (t) => {
            let started, zoomed, ended;
            const eventData = {data: 'ok'};

            camera
                .on('zoomstart', (d) => { started = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => { ended = d.data; });

            camera.jumpTo({zoom: 3}, eventData);
            t.equal(started, 'ok');
            t.equal(zoomed, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('emits rotate events, preserving eventData', (t) => {
            let started, rotated, ended;
            const eventData = {data: 'ok'};

            camera
                .on('rotatestart', (d) => { started = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => { ended = d.data; });

            camera.jumpTo({bearing: 90}, eventData);
            t.equal(started, 'ok');
            t.equal(rotated, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('emits pitch events, preserving eventData', (t) => {
            let started, pitched, ended;
            const eventData = {data: 'ok'};

            camera
                .on('pitchstart', (d) => { started = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('pitchend', (d) => { ended = d.data; });

            camera.jumpTo({pitch: 10}, eventData);
            t.equal(started, 'ok');
            t.equal(pitched, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('cancels in-progress easing', (t) => {
            camera.panTo([3, 4]);
            t.ok(camera.isEasing());
            camera.jumpTo({center: [1, 2]});
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#setCenter', (t) => {
        // Choose initial zoom to avoid center being constrained by mercator latitude limits.
        const camera = createCamera({zoom: 1});

        t.test('sets center', (t) => {
            camera.setCenter([1, 2]);
            t.deepEqual(camera.getCenter(), {lng: 1, lat: 2});
            t.end();
        });

        t.test('throws on invalid center argument', (t) => {
            t.throws(() => {
                camera.jumpTo({center: 1});
            }, Error, 'throws with non-LngLatLike argument');
            t.end();
        });

        t.test('emits move events, preserving eventData', (t) => {
            let started, moved, ended;
            const eventData = {data: 'ok'};

            camera.on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { ended = d.data; });

            camera.setCenter([10, 20], eventData);
            t.equal(started, 'ok');
            t.equal(moved, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('cancels in-progress easing', (t) => {
            camera.panTo([3, 4]);
            t.ok(camera.isEasing());
            camera.setCenter([1, 2]);
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#setZoom', (t) => {
        const camera = createCamera();

        t.test('sets zoom', (t) => {
            camera.setZoom(3);
            t.deepEqual(camera.getZoom(), 3);
            t.end();
        });

        t.test('emits move and zoom events, preserving eventData', (t) => {
            let movestarted, moved, moveended, zoomstarted, zoomed, zoomended;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { moveended = d.data; })
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => { zoomended = d.data; });

            camera.setZoom(4, eventData);
            t.equal(movestarted, 'ok');
            t.equal(moved, 'ok');
            t.equal(moveended, 'ok');
            t.equal(zoomstarted, 'ok');
            t.equal(zoomed, 'ok');
            t.equal(zoomended, 'ok');
            t.end();
        });

        t.test('cancels in-progress easing', (t) => {
            camera.panTo([3, 4]);
            t.ok(camera.isEasing());
            camera.setZoom(5);
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#setBearing', (t) => {
        const camera = createCamera();

        t.test('sets bearing', (t) => {
            camera.setBearing(4);
            t.deepEqual(camera.getBearing(), 4);
            t.end();
        });

        t.test('emits move and rotate events, preserving eventData', (t) => {
            let movestarted, moved, moveended, rotatestarted, rotated, rotateended;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { moveended = d.data; })
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => { rotateended = d.data; });

            camera.setBearing(5, eventData);
            t.equal(movestarted, 'ok');
            t.equal(moved, 'ok');
            t.equal(moveended, 'ok');
            t.equal(rotatestarted, 'ok');
            t.equal(rotated, 'ok');
            t.equal(rotateended, 'ok');
            t.end();
        });

        t.test('cancels in-progress easing', (t) => {
            camera.panTo([3, 4]);
            t.ok(camera.isEasing());
            camera.setBearing(6);
            t.ok(!camera.isEasing());
            t.end();
        });

        t.end();
    });

    t.test('#setPadding', (t) => {
        t.test('sets padding', (t) => {
            const camera = createCamera();
            const padding = {left: 300, top: 100, right: 50, bottom: 10};
            camera.setPadding(padding);
            t.deepEqual(camera.getPadding(), padding);
            t.end();
        });

        t.test('existing padding is retained if no new values are passed in', (t) => {
            const camera = createCamera();
            const padding = {left: 300, top: 100, right: 50, bottom: 10};
            camera.setPadding(padding);
            camera.setPadding({});

            const currentPadding = camera.getPadding();
            t.deepEqual(currentPadding, padding);
            t.end();
        });

        t.test('doesnt change padding thats already present if new value isnt passed in', (t) => {
            const camera = createCamera();
            const padding = {left: 300, top: 100, right: 50, bottom: 10};
            camera.setPadding(padding);
            const padding1 = {right: 100};
            camera.setPadding(padding1);

            const currentPadding = camera.getPadding();
            t.equal(currentPadding.left, padding.left);
            t.equal(currentPadding.top, padding.top);
            // padding1 here
            t.equal(currentPadding.right, padding1.right);
            t.equal(currentPadding.bottom, padding.bottom);
            t.end();
        });

        t.end();
    });

    t.test('#panBy', (t) => {
        t.test('pans by specified amount', (t) => {
            const camera = createCamera();
            camera.panBy([100, 0], {duration: 0});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 70.3125, lat: 0});
            t.end();
        });

        t.test('pans relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.panBy([100, 0], {duration: 0});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: -70.3125, lat: 0});
            t.end();
        });

        t.test('pans equally in both directions', (t) => {
            const camera = createCamera({bearing: 0});
            const c = camera.getCenter();
            camera.panBy([0, -10000], {duration: 0});
            const c1 = camera.getCenter();
            camera.panBy([0, 10000], {duration: 0});
            const c2 = camera.getCenter();
            t.ok(Math.abs(c1.lat - c.lat) - Math.abs(c2.lat - c.lat) < 1e-10);
            t.end();
        });

        t.test('emits move events, preserving eventData', (t) => {
            const camera = createCamera();
            let started, moved;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    t.equal(started, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(d.data, 'ok');
                    t.end();
                });

            camera.panBy([100, 0], {duration: 0}, eventData);
        });

        t.test('supresses movestart if noMoveStart option is true', (t) => {
            const camera = createCamera();
            let started;

            // fire once in advance to satisfy assertions that moveend only comes after movestart
            camera.fire('movestart');

            camera
                .on('movestart', () => { started = true; })
                .on('moveend', () => {
                    t.ok(!started);
                    t.end();
                });

            camera.panBy([100, 0], {duration: 0, noMoveStart: true});
        });

        t.end();
    });

    t.test('#panTo', (t) => {
        t.test('pans to specified location', (t) => {
            const camera = createCamera();
            camera.panTo([100, 0], {duration: 0});
            t.deepEqual(camera.getCenter(), {lng: 100, lat: 0});
            t.end();
        });

        t.test('throws on invalid center argument', (t) => {
            const camera = createCamera();
            t.throws(() => {
                camera.panTo({center: 1});
            }, Error, 'throws with non-LngLatLike argument');
            t.end();
        });

        t.test('pans with specified offset', (t) => {
            const camera = createCamera();
            camera.panTo([100, 0], {offset: [100, 0], duration: 0});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 29.6875, lat: 0});
            t.end();
        });

        t.test('pans with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.panTo([100, 0], {offset: [100, 0], duration: 0});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 170.3125, lat: 0});
            t.end();
        });

        t.test('emits move events, preserving eventData', (t) => {
            const camera = createCamera();
            let started, moved;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    t.equal(started, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(d.data, 'ok');
                    t.end();
                });

            camera.panTo([100, 0], {duration: 0}, eventData);
        });

        t.test('supresses movestart if noMoveStart option is true', (t) => {
            const camera = createCamera();
            let started;

            // fire once in advance to satisfy assertions that moveend only comes after movestart
            camera.fire('movestart');

            camera
                .on('movestart', () => { started = true; })
                .on('moveend', () => {
                    t.ok(!started);
                    t.end();
                });

            camera.panTo([100, 0], {duration: 0, noMoveStart: true});
        });

        t.end();
    });

    t.test('#zoomTo', (t) => {
        t.test('zooms to specified level', (t) => {
            const camera = createCamera();
            camera.zoomTo(3.2, {duration: 0});
            t.equal(camera.getZoom(), 3.2);
            t.end();
        });

        t.test('zooms around specified location', (t) => {
            const camera = createCamera();
            camera.zoomTo(3.2, {around: [5, 0], duration: 0});
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({lng: 4.455905898, lat: 0}));
            t.end();
        });

        t.test('zooms with specified offset', (t) => {
            const camera = createCamera();
            camera.zoomTo(3.2, {offset: [100, 0], duration: 0});
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({lng: 62.66117668978015, lat: 0}));
            t.end();
        });

        t.test('zooms with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.zoomTo(3.2, {offset: [100, 0], duration: 0});
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({lng: -62.66117668978012, lat: 0}));
            t.end();
        });

        t.test('emits move and zoom events, preserving eventData', (t) => {
            const camera = createCamera();
            let movestarted, moved, zoomstarted, zoomed;
            const eventData = {data: 'ok'};

            t.plan(6);

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => {
                    t.equal(zoomstarted, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera.zoomTo(5, {duration: 0}, eventData);
        });

        t.end();
    });

    t.test('#rotateTo', (t) => {
        t.test('rotates to specified bearing', (t) => {
            const camera = createCamera();
            camera.rotateTo(90, {duration: 0});
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('rotates around specified location', (t) => {
            const camera = createCamera({zoom: 3});
            camera.rotateTo(90, {around: [5, 0], duration: 0});
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({lng: 5, lat: 4.993665859}));
            t.end();
        });

        t.test('rotates around specified location, constrained to fit the view', (t) => {
            const camera = createCamera({zoom: 0});
            camera.rotateTo(90, {around: [5, 0], duration: 0});
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({lng: 4.999999999999972, lat: 0.000002552471840999715}));
            t.end();
        });

        t.test('rotates with specified offset', (t) => {
            const camera = createCamera({zoom: 1});
            camera.rotateTo(90, {offset: [200, 0], duration: 0});
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({lng: 70.3125, lat: 57.3265212252}));
            t.end();
        });

        t.test('rotates with specified offset, constrained to fit the view', (t) => {
            const camera = createCamera({zoom: 0});
            camera.rotateTo(90, {offset: [100, 0], duration: 0});
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({lng: 70.3125, lat: 0.000002552471840999715}));
            t.end();
        });

        t.test('rotates with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180, zoom: 1});
            camera.rotateTo(90, {offset: [200, 0], duration: 0});
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({lng: -70.3125, lat: 57.3265212252}));
            t.end();
        });

        t.test('emits move and rotate events, preserving eventData', (t) => {
            const camera = createCamera();
            let movestarted, moved, rotatestarted, rotated;
            const eventData = {data: 'ok'};

            t.plan(6);

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => {
                    t.equal(rotatestarted, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera.rotateTo(90, {duration: 0}, eventData);
        });

        t.end();
    });

    t.test('#easeTo', (t) => {
        t.test('pans to specified location', (t) => {
            const camera = createCamera();
            camera.easeTo({center: [100, 0], duration: 0});
            t.deepEqual(camera.getCenter(), {lng: 100, lat: 0});
            t.end();
        });

        t.test('zooms to specified level', (t) => {
            const camera = createCamera();
            camera.easeTo({zoom: 3.2, duration: 0});
            t.equal(camera.getZoom(), 3.2);
            t.end();
        });

        t.test('rotates to specified bearing', (t) => {
            const camera = createCamera();
            camera.easeTo({bearing: 90, duration: 0});
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('pitches to specified pitch', (t) => {
            const camera = createCamera();
            camera.easeTo({pitch: 45, duration: 0});
            t.equal(camera.getPitch(), 45);
            t.end();
        });

        t.test('pans and zooms', (t) => {
            const camera = createCamera();
            camera.easeTo({center: [100, 0], zoom: 3.2, duration: 0});
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({lng: 100, lat: 0}));
            t.equal(camera.getZoom(), 3.2);
            t.end();
        });

        t.test('zooms around a point', (t) => {
            const camera = createCamera();
            camera.easeTo({around: [100, 0], zoom: 3, duration: 0});
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({lng: 87.5, lat: 0}));
            t.equal(camera.getZoom(), 3);
            t.end();
        });

        t.test('pans and rotates', (t) => {
            const camera = createCamera();
            camera.easeTo({center: [100, 0], bearing: 90, duration: 0});
            t.deepEqual(camera.getCenter(), {lng: 100, lat: 0});
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('zooms and rotates', (t) => {
            const camera = createCamera();
            camera.easeTo({zoom: 3.2, bearing: 90, duration: 0});
            t.equal(camera.getZoom(), 3.2);
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('pans, zooms, and rotates', (t) => {
            const camera = createCamera({bearing: -90});
            camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 0});
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({lng: 100, lat: 0}));
            t.equal(camera.getZoom(), 3.2);
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('noop', (t) => {
            const camera = createCamera();
            camera.easeTo({duration: 0});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 0, lat: 0});
            t.equal(camera.getZoom(), 0);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('noop with offset', (t) => {
            const camera = createCamera();
            camera.easeTo({offset: [100, 0], duration: 0});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 0, lat: 0});
            t.equal(camera.getZoom(), 0);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('pans with specified offset', (t) => {
            const camera = createCamera();
            camera.easeTo({center: [100, 0], offset: [100, 0], duration: 0});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 29.6875, lat: 0});
            t.end();
        });

        t.test('pans with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.easeTo({center: [100, 0], offset: [100, 0], duration: 0});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 170.3125, lat: 0});
            t.end();
        });

        t.test('zooms with specified offset', (t) => {
            const camera = createCamera();
            camera.easeTo({zoom: 3.2, offset: [100, 0], duration: 0});
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({lng: 62.66117668978015, lat: 0}));
            t.end();
        });

        t.test('zooms with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.easeTo({zoom: 3.2, offset: [100, 0], duration: 0});
            t.equal(camera.getZoom(), 3.2);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({lng: -62.66117668978012, lat: 0}));
            t.end();
        });

        t.test('rotates with specified offset', (t) => {
            const camera = createCamera();
            camera.easeTo({bearing: 90, offset: [100, 0], duration: 0});
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({lng: 70.3125, lat: 0.000002552471840999715}));
            t.end();
        });

        t.test('rotates with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.easeTo({bearing: 90, offset: [100, 0], duration: 0});
            t.equal(camera.getBearing(), 90);
            t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat({lng: -70.3125, lat: 0.000002552471840999715}));
            t.end();
        });

        t.test('emits move, zoom, rotate, and pitch events, preserving eventData', (t) => {
            const camera = createCamera();
            let movestarted, moved, zoomstarted, zoomed, rotatestarted, rotated, pitchstarted, pitched;
            const eventData = {data: 'ok'};

            t.plan(18);

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => {
                    t.notOk(camera._zooming);
                    t.notOk(camera._panning);
                    t.notOk(camera._rotating);

                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(pitched, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => {
                    t.equal(zoomstarted, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => {
                    t.equal(rotatestarted, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('pitchstart', (d) => { pitchstarted = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('pitchend', (d) => {
                    t.equal(pitchstarted, 'ok');
                    t.equal(pitched, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera.easeTo(
                {center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45},
                eventData);
        });

        t.test('does not emit zoom events if not zooming', (t) => {
            const camera = createCamera();

            camera
                .on('zoomstart', () => { t.fail(); })
                .on('zoom', () => { t.fail(); })
                .on('zoomend', () => { t.fail(); })
                .on('moveend', () => { t.end(); });

            camera.easeTo({center: [100, 0], duration: 0});
        });

        t.test('stops existing ease', (t) => {
            const camera = createCamera();
            camera.easeTo({center: [200, 0], duration: 100});
            camera.easeTo({center: [100, 0], duration: 0});
            t.deepEqual(camera.getCenter(), {lng: 100, lat: 0});
            t.end();
        });

        t.test('can be called from within a moveend event handler', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            stub.callsFake(() => 0);
            camera.easeTo({center: [100, 0], duration: 10});

            camera.once('moveend', () => {
                camera.easeTo({center: [200, 0], duration: 10});
                camera.once('moveend', () => {
                    camera.easeTo({center: [300, 0], duration: 10});
                    camera.once('moveend', () => {
                        t.end();
                    });

                    setTimeout(() => {
                        stub.callsFake(() => 30);
                        camera.simulateFrame();
                    }, 0);
                });

                // setTimeout to avoid a synchronous callback
                setTimeout(() => {
                    stub.callsFake(() => 20);
                    camera.simulateFrame();
                }, 0);
            });

            // setTimeout to avoid a synchronous callback
            setTimeout(() => {
                stub.callsFake(() => 10);
                camera.simulateFrame();
            }, 0);
        });

        t.test('pans eastward across the antimeridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng > 170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(crossedAntimeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.easeTo({center: [-170, 0], duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('pans westward across the antimeridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([-170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng < -170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(crossedAntimeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.easeTo({center: [170, 0], duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('animation occurs when prefers-reduced-motion: reduce is set but overridden by essential: true', (t) => {
            const camera = createCamera();
            const stubPrefersReducedMotion = t.stub(browser, 'prefersReducedMotion');
            const stubNow = t.stub(browser, 'now');

            stubPrefersReducedMotion.get(() => true);

            // camera transition expected to take in this range when prefersReducedMotion is set and essential: true,
            // when a duration of 200 is requested
            const min = 100;
            const max = 300;

            let startTime;
            camera
                .on('movestart', () => { startTime = browser.now(); })
                .on('moveend', () => {
                    const endTime = browser.now();
                    const timeDiff = endTime - startTime;
                    t.ok(timeDiff >= min && timeDiff < max, `Camera transition time exceeded expected range( [${min},${max}) ) :${timeDiff}`);
                    t.end();
                });

            setTimeout(() => {
                stubNow.callsFake(() => 0);
                camera.simulateFrame();

                camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 200, essential: true});

                setTimeout(() => {
                    stubNow.callsFake(() => 200);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('duration is 0 when prefers-reduced-motion: reduce is set', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'prefersReducedMotion');
            stub.get(() => true);
            assertTransitionTime(t, camera, 0, 10);
            camera.easeTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 1000});
        });

        t.test('Globe', (t) => {
            t.test('pans to specified location', (t) => {
                const camera = createCamera();
                camera.transform.zoom = 4;
                camera.transform.setProjection({name: 'globe'});

                camera.easeTo({center: [90, 10], duration:0});
                t.deepEqual(camera.getCenter(), {lng: 90, lat: 10});

                t.end();
            });

            t.test('rotate the globe once around its axis', (t) => {
                const camera = createCamera();
                const stub = t.stub(browser, 'now');
                stub.callsFake(() => 0);

                camera.transform.zoom = 4;
                camera.transform.setProjection({name: 'globe'});

                camera.easeTo({center: [360, 0], duration: 100, easing: e => e});

                camera.simulateFrame();
                t.deepEqual(camera.getCenter(), {lng: 0, lat: 0});

                stub.callsFake(() => 25);
                camera.simulateFrame();
                t.deepEqual(camera.getCenter(), {lng: 90, lat: 0});

                stub.callsFake(() => 50);
                camera.simulateFrame();
                t.deepEqual(camera.getCenter(), {lng: 180, lat: 0});

                stub.callsFake(() => 75);
                camera.simulateFrame();
                t.deepEqual(camera.getCenter(), {lng: -90, lat: 0});

                stub.callsFake(() => 100);
                camera.simulateFrame();
                t.deepEqual(camera.getCenter(), {lng: 0, lat: 0});

                t.end();
            });

            t.test('pans with padding', (t) => {
                const camera = createCamera();
                camera.transform.setProjection({name: 'globe'});

                camera.easeTo({center: [90, 0], duration:0, padding:{top: 100}});
                t.deepEqual(camera.getCenter(), {lng: 90, lat: 0});
                t.deepEqual(camera.getPadding(), {top:100, bottom:0, left:0, right:0});
                t.end();
            });

            t.test('pans with specified offset and bearing', (t) => {
                const camera = createCamera();
                const stub = t.stub(browser, 'now');
                stub.callsFake(() => 0);

                camera.transform.setProjection({name: 'globe'});
                camera.easeTo({center: [170, 0], offset: [100, 0], duration: 2000, bearing: 45});

                for (let i = 1; i <= 10; i++) {
                    stub.callsFake(() => i * 200);
                    camera.simulateFrame();
                }

                t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 99.6875, lat: 0});
                t.end();
            });

            t.test('reset north', (t) => {
                const camera = createCamera();
                const stub = t.stub(browser, 'now');
                stub.callsFake(() => 0);

                camera.transform.zoom = 4;
                camera.transform.bearing = 160;
                camera.transform.pitch = 20;
                camera.transform.setProjection({name: 'globe'});

                camera.resetNorth({easing: e => e});
                camera.simulateFrame();

                t.deepEqual(camera.transform.bearing, 160);

                stub.callsFake(() => 250);
                camera.simulateFrame();
                t.deepEqual(camera.transform.bearing, 120);

                stub.callsFake(() => 500);
                camera.simulateFrame();
                t.deepEqual(camera.transform.bearing, 80);

                stub.callsFake(() => 750);
                camera.simulateFrame();
                t.deepEqual(camera.transform.bearing, 40);

                stub.callsFake(() => 1000);
                camera.simulateFrame();
                t.deepEqual(camera.transform.bearing, 0);
                t.deepEqual(camera.transform.pitch, 20);

                t.end();
            });

            t.test('reset north and pitch', (t) => {
                const camera = createCamera();
                const stub = t.stub(browser, 'now');
                stub.callsFake(() => 0);

                camera.transform.zoom = 4;
                camera.transform.bearing = 160;
                camera.transform.pitch = 20;
                camera.transform.setProjection({name: 'globe'});

                camera.resetNorthPitch({easing: e => e});
                camera.simulateFrame();

                t.deepEqual(camera.transform.bearing, 160);
                t.deepEqual(camera.transform.pitch, 20);

                stub.callsFake(() => 250);
                camera.simulateFrame();
                t.deepEqual(camera.transform.bearing, 120);
                t.deepEqual(camera.transform.pitch, 15);

                stub.callsFake(() => 500);
                camera.simulateFrame();
                t.deepEqual(camera.transform.bearing, 80);
                t.deepEqual(camera.transform.pitch, 10);

                stub.callsFake(() => 750);
                camera.simulateFrame();
                t.deepEqual(camera.transform.bearing, 40);
                t.deepEqual(camera.transform.pitch, 5);

                stub.callsFake(() => 1000);
                camera.simulateFrame();
                t.deepEqual(camera.transform.bearing, 0);
                t.deepEqual(camera.transform.pitch, 0);

                t.end();
            });

            t.test('sets bearing', (t) => {
                const camera = createCamera();
                camera.transform.setProjection({name: 'globe'});

                camera.setBearing(4);
                t.deepEqual(camera.getBearing(), 4);
                t.end();
            });

            t.test('sets center', (t) => {
                const camera = createCamera();
                camera.transform.setProjection({name: 'globe'});
                camera.transform.zoom = 2;

                camera.setCenter([1, 2]);
                t.deepEqual(camera.getCenter(), {lng: 1, lat: 2});
                t.end();
            });

            t.test('invoke `panBy` with specific amount', (t) => {
                const camera = createCamera();
                camera.transform.setProjection({name: 'globe'});

                camera.panBy([100, 0], {duration: 0});
                t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 70.3125, lat: 0});
                t.end();
            });

            t.test('invoke `panBy` with specific amount with rotated and pitched camera', (t) => {
                const camera = createCamera();
                camera.transform.setProjection({name: 'globe'});
                camera.transform.bearing = 90;
                camera.transform.pitch = 45;
                camera.transform.zoom = 3;

                // Expect linear movement to both directions
                camera.panBy([700, 0], {duration: 0});
                t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 0, lat: -52.268157374});

                camera.panBy([-700, 0], {duration: 0});
                t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 0, lat: 0});

                t.end();
            });

            t.test('invoke `panTo` with specific amount', (t) => {
                const camera = createCamera();
                camera.transform.setProjection({name: 'globe'});

                camera.panTo([100, 0], {duration: 0});
                t.deepEqual(camera.getCenter(), {lng: 100, lat: 0});
                t.end();
            });

            t.end();
        });

        t.end();
    });

    t.test('#flyTo', (t) => {
        t.test('pans to specified location', (t) => {
            const camera = createCamera();
            camera.flyTo({center: [100, 0], animate: false});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 100, lat: 0});
            t.end();
        });

        t.test('throws on invalid center argument', (t) => {
            const camera = createCamera();
            t.throws(() => {
                camera.flyTo({center: 1});
            }, Error, 'throws with non-LngLatLike argument');
            t.end();
        });

        t.test('does not throw when cameras current zoom is sufficiently greater than passed zoom option', (t) => {
            const camera = createCamera({zoom: 22, center:[0, 0]});
            t.doesNotThrow(() => camera.flyTo({zoom:10, center:[0, 0]}));
            t.end();
        });

        t.test('does not throw when cameras current zoom is above maxzoom and an offset creates infinite zoom out factor', (t) => {
            const transform = new Transform(0, 20.9999, 0, 60, true);
            transform.resize(512, 512);
            const camera = attachSimulateFrame(new Camera(transform, {}))
                .jumpTo({zoom: 21, center:[0, 0]});
            camera._update = () => {};
            camera._preloadTiles = () => {};
            t.doesNotThrow(() => camera.flyTo({zoom:7.5, center:[0, 0], offset:[0, 70]}));
            t.end();
        });

        t.test('zooms to specified level', (t) => {
            const camera = createCamera();
            camera.flyTo({zoom: 3.2, animate: false});
            t.equal(fixedNum(camera.getZoom()), 3.2);
            t.end();
        });

        t.test('zooms to integer level without floating point errors', (t) => {
            const camera = createCamera({zoom: 0.6});
            camera.flyTo({zoom: 2, animate: false});
            t.equal(camera.getZoom(), 2);
            t.end();
        });

        t.test('Zoom out from the same position to the same position with animation', (t) => {
            const pos = {lng: 0, lat: 0};
            const camera = createCamera({zoom: 20, center: pos});
            const stub = t.stub(browser, 'now');

            camera.once('zoomend', () => {
                t.deepEqual(fixedLngLat(camera.getCenter()), fixedLngLat(pos));
                t.equal(camera.getZoom(), 19);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({zoom: 19, center: pos, duration: 2});

            stub.callsFake(() => 3);
            camera.simulateFrame();
        });

        t.test('rotates to specified bearing', (t) => {
            const camera = createCamera();
            camera.flyTo({bearing: 90, animate: false});
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('tilts to specified pitch', (t) => {
            const camera = createCamera();
            camera.flyTo({pitch: 45, animate: false});
            t.equal(camera.getPitch(), 45);
            t.end();
        });

        t.test('pans and zooms', (t) => {
            const camera = createCamera();
            camera.flyTo({center: [100, 0], zoom: 3.2, animate: false});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 100, lat: 0});
            t.equal(fixedNum(camera.getZoom()), 3.2);
            t.end();
        });

        t.test('pans and rotates', (t) => {
            const camera = createCamera();
            camera.flyTo({center: [100, 0], bearing: 90, animate: false});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 100, lat: 0});
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('zooms and rotates', (t) => {
            const camera = createCamera();
            camera.flyTo({zoom: 3.2, bearing: 90, animate: false});
            t.equal(fixedNum(camera.getZoom()), 3.2);
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('pans, zooms, and rotates', (t) => {
            const camera = createCamera();
            camera.flyTo({center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, animate: false});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 100, lat: 0});
            t.equal(fixedNum(camera.getZoom()), 3.2);
            t.equal(camera.getBearing(), 90);
            t.end();
        });

        t.test('noop', (t) => {
            const camera = createCamera();
            camera.flyTo({animate: false});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 0, lat: 0});
            t.equal(camera.getZoom(), 0);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('noop with offset', (t) => {
            const camera = createCamera();
            camera.flyTo({offset: [100, 0], animate: false});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 0, lat: 0});
            t.equal(camera.getZoom(), 0);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('pans with specified offset', (t) => {
            const camera = createCamera();
            camera.flyTo({center: [100, 0], offset: [100, 0], animate: false});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 29.6875, lat: 0});
            t.end();
        });

        t.test('pans with specified offset relative to viewport on a rotated camera', (t) => {
            const camera = createCamera({bearing: 180});
            camera.easeTo({center: [100, 0], offset: [100, 0], animate: false});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 170.3125, lat: 0});
            t.end();
        });

        t.test('emits move, zoom, rotate, and pitch events, preserving eventData', (t) => {
            t.plan(18);

            const camera = createCamera();
            let movestarted, moved, zoomstarted, zoomed, rotatestarted, rotated, pitchstarted, pitched;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('moveend', function(d) {
                    t.notOk(this._zooming);
                    t.notOk(this._panning);
                    t.notOk(this._rotating);

                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(pitched, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => {
                    t.equal(zoomstarted, 'ok');
                    t.equal(zoomed, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => {
                    t.equal(rotatestarted, 'ok');
                    t.equal(rotated, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera
                .on('pitchstart', (d) => { pitchstarted = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('pitchend', (d) => {
                    t.equal(pitchstarted, 'ok');
                    t.equal(pitched, 'ok');
                    t.equal(d.data, 'ok');
                });

            camera.flyTo(
                {center: [100, 0], zoom: 3.2, bearing: 90, duration: 0, pitch: 45, animate: false},
                eventData);
        });

        t.test('for short flights, emits (solely) move events, preserving eventData', (t) => {
            //As I type this, the code path for guiding super-short flights is (and will probably remain) different.
            //As such; it deserves a separate test case. This test case flies the map from A to A.
            const camera = createCamera({center: [100, 0]});
            let movestarted, moved,
                zoomstarted, zoomed, zoomended,
                rotatestarted, rotated, rotateended,
                pitchstarted, pitched, pitchended;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { movestarted = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoomed = d.data; })
                .on('zoomend', (d) => { zoomended = d.data; })
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => { rotateended = d.data; })
                .on('pitchstart', (d) => { pitchstarted = d.data; })
                .on('pitch', (d) => { pitched = d.data; })
                .on('pitchend', (d) => { pitchended = d.data; })
                .on('moveend', function(d) {
                    t.notOk(this._zooming);
                    t.notOk(this._panning);
                    t.notOk(this._rotating);

                    t.equal(movestarted, 'ok');
                    t.equal(moved, 'ok');
                    t.equal(zoomstarted, undefined);
                    t.equal(zoomed, undefined);
                    t.equal(zoomended, undefined);
                    t.equal(rotatestarted, undefined);
                    t.equal(rotated, undefined);
                    t.equal(rotateended, undefined);
                    t.equal(pitched, undefined);
                    t.equal(pitchstarted, undefined);
                    t.equal(pitchended, undefined);
                    t.equal(d.data, 'ok');
                    t.end();
                });

            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);

            camera.flyTo({center: [100, 0], duration: 10}, eventData);

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('stops existing ease', (t) => {
            const camera = createCamera();
            camera.flyTo({center: [200, 0], duration: 100});
            camera.flyTo({center: [100, 0], duration: 0});
            t.deepEqual(fixedLngLat(camera.getCenter()), {lng: 100, lat: 0});
            t.end();
        });

        t.test('can be called from within a moveend event handler', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);

            camera.flyTo({center: [100, 0], duration: 10});
            camera.once('moveend', () => {
                camera.flyTo({center: [200, 0], duration: 10});
                camera.once('moveend', () => {
                    camera.flyTo({center: [300, 0], duration: 10});
                    camera.once('moveend', () => {
                        t.end();
                    });
                });
            });

            setTimeout(() => {
                stub.callsFake(() => 10);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 20);
                    camera.simulateFrame();

                    setTimeout(() => {
                        stub.callsFake(() => 30);
                        camera.simulateFrame();
                    }, 0);
                }, 0);
            }, 0);
        });

        t.test('ascends', (t) => {
            const camera = createCamera();
            camera.setZoom(18);
            let ascended;

            camera.on('zoom', () => {
                if (camera.getZoom() < 18) {
                    ascended = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(ascended);
                t.end();
            });

            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);

            camera.flyTo({center: [100, 0], zoom: 18, duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('pans eastward across the prime meridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([-10, 0]);
            let crossedPrimeMeridian;

            camera.on('move', () => {
                if (Math.abs(camera.getCenter().lng) < 10) {
                    crossedPrimeMeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(crossedPrimeMeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [10, 0], duration: 20});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 20);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('pans westward across the prime meridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([10, 0]);
            let crossedPrimeMeridian;

            camera.on('move', () => {
                if (Math.abs(camera.getCenter().lng) < 10) {
                    crossedPrimeMeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(crossedPrimeMeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [-10, 0], duration: 20});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 20);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('pans eastward across the antimeridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng > 170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(crossedAntimeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [-170, 0], duration: 20});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 20);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('pans westward across the antimeridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([-170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng < -170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(crossedAntimeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [170, 0], duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('does not pan eastward across the antimeridian if no world copies', (t) => {
            const camera = createCamera({renderWorldCopies: false});
            const stub = t.stub(browser, 'now');

            camera.setCenter([170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (camera.getCenter().lng > 170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.notOk(crossedAntimeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [-170, 0], duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('does not pan westward across the antimeridian if no world copies', (t) => {
            const camera = createCamera({renderWorldCopies: false});
            const stub = t.stub(browser, 'now');

            camera.setCenter([-170, 0]);
            let crossedAntimeridian;

            camera.on('move', () => {
                if (fixedLngLat(camera.getCenter(), 10).lng < -170) {
                    crossedAntimeridian = true;
                }
            });

            camera.on('moveend', () => {
                t.notOk(crossedAntimeridian);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [170, 0], duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('jumps back to world 0 when crossing the antimeridian', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'now');

            camera.setCenter([-170, 0]);

            let leftWorld0 = false;

            camera.on('move', () => {
                leftWorld0 = leftWorld0 || (camera.getCenter().lng < -180);
            });

            camera.on('moveend', () => {
                t.false(leftWorld0);
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [170, 0], duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('peaks at the specified zoom level', (t) => {
            const camera = createCamera({zoom: 20});
            const stub = t.stub(browser, 'now');

            const minZoom = 1;
            let zoomed = false;

            camera.on('zoom', () => {
                const zoom = camera.getZoom();
                if (zoom < 1) {
                    t.fail(`${zoom} should be >= ${minZoom} during flyTo`);
                }

                if (camera.getZoom() < (minZoom + 1)) {
                    zoomed = true;
                }
            });

            camera.on('moveend', () => {
                t.ok(zoomed, 'zoom came within satisfactory range of minZoom provided');
                t.end();
            });

            stub.callsFake(() => 0);
            camera.flyTo({center: [1, 0], zoom: 20, minZoom, duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 3);
                camera.simulateFrame();

                setTimeout(() => {
                    stub.callsFake(() => 10);
                    camera.simulateFrame();
                }, 0);
            }, 0);
        });

        t.test('respects transform\'s maxZoom', (t) => {
            const transform = new Transform(2, 10, 0, 60, false);
            transform.resize(512, 512);

            const camera = attachSimulateFrame(new Camera(transform, {}));
            camera._update = () => {};
            camera._preloadTiles = () => {};

            camera.on('moveend', () => {
                equalWithPrecision(t, camera.getZoom(), 10, 1e-10);
                const {lng, lat} = camera.getCenter();
                equalWithPrecision(t, lng, 12, 1e-10);
                equalWithPrecision(t, lat, 34, 1e-10);

                t.end();
            });

            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.flyTo({center: [12, 34], zoom: 30, duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 10);
                camera.simulateFrame();
            }, 0);
        });

        t.test('respects transform\'s minZoom', (t) => {
            const transform = new Transform(2, 10, 0, 60, false);
            transform.resize(512, 512);

            const camera = attachSimulateFrame(new Camera(transform, {}));
            camera._update = () => {};
            camera._preloadTiles = () => {};

            camera.on('moveend', () => {
                equalWithPrecision(t, camera.getZoom(), 2, 1e-10);
                const {lng, lat} = camera.getCenter();
                equalWithPrecision(t, lng, 12, 1e-10);
                equalWithPrecision(t, lat, 34, 1e-10);

                t.end();
            });

            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.flyTo({center: [12, 34], zoom: 1, duration: 10});

            setTimeout(() => {
                stub.callsFake(() => 10);
                camera.simulateFrame();
            }, 0);
        });

        t.test('resets duration to 0 if it exceeds maxDuration', (t) => {
            let startTime, endTime, timeDiff;
            const camera = createCamera({center: [37.63454, 55.75868], zoom: 18});

            camera
                .on('movestart', () => { startTime = new Date(); })
                .on('moveend', () => {
                    endTime = new Date();
                    timeDiff = endTime - startTime;
                    equalWithPrecision(t, timeDiff, 0, 1e+1);
                    t.end();
                });

            camera.flyTo({center: [-122.3998631, 37.7884307], maxDuration: 100});
        });

        t.test('flys instantly when prefers-reduce-motion:reduce is set', (t) => {
            const camera = createCamera();
            const stub = t.stub(browser, 'prefersReducedMotion');
            stub.get(() => true);
            assertTransitionTime(t, camera, 0, 10);
            camera.flyTo({center: [100, 0], bearing: 90, animate: true});
        });

        t.end();
    });

    t.test('#isEasing', (t) => {
        t.test('returns false when not easing', (t) => {
            const camera = createCamera();
            t.ok(!camera.isEasing());
            t.end();
        });

        t.test('returns true when panning', (t) => {
            const camera = createCamera();
            camera.panTo([100, 0], {duration: 1});
            t.ok(camera.isEasing());
            t.end();
        });

        t.test('returns false when done panning', (t) => {
            const camera = createCamera();
            camera.on('moveend', () => {
                t.ok(!camera.isEasing());
                t.end();
            });
            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.panTo([100, 0], {duration: 1});
            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();
            }, 0);
        });

        t.test('returns true when zooming', (t) => {
            const camera = createCamera();
            camera.zoomTo(3.2, {duration: 1});
            t.ok(camera.isEasing());
            t.end();
        });

        t.test('returns false when done zooming', (t) => {
            const camera = createCamera();
            camera.on('moveend', () => {
                t.ok(!camera.isEasing());
                t.end();
            });
            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.zoomTo(3.2, {duration: 1});
            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();
            }, 0);
        });

        t.test('returns true when rotating', (t) => {
            const camera = createCamera();
            camera.rotateTo(90, {duration: 1});
            t.ok(camera.isEasing());
            t.end();
        });

        t.test('returns false when done rotating', (t) => {
            const camera = createCamera();
            camera.on('moveend', () => {
                t.ok(!camera.isEasing());
                t.end();
            });
            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.rotateTo(90, {duration: 1});
            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();
            }, 0);
        });

        t.end();
    });

    t.test('#stop', (t) => {
        t.test('resets camera._zooming', (t) => {
            const camera = createCamera();
            camera.zoomTo(3.2);
            camera.stop();
            t.ok(!camera._zooming);
            t.end();
        });

        t.test('resets camera._rotating', (t) => {
            const camera = createCamera();
            camera.rotateTo(90);
            camera.stop();
            t.ok(!camera._rotating);
            t.end();
        });

        t.test('emits moveend if panning, preserving eventData', (t) => {
            const camera = createCamera();
            const eventData = {data: 'ok'};

            camera.on('moveend', (d) => {
                t.equal(d.data, 'ok');
                t.end();
            });

            camera.panTo([100, 0], {}, eventData);
            camera.stop();
        });

        t.test('emits moveend if zooming, preserving eventData', (t) => {
            const camera = createCamera();
            const eventData = {data: 'ok'};

            camera.on('moveend', (d) => {
                t.equal(d.data, 'ok');
                t.end();
            });

            camera.zoomTo(3.2, {}, eventData);
            camera.stop();
        });

        t.test('emits moveend if rotating, preserving eventData', (t) => {
            const camera = createCamera();
            const eventData = {data: 'ok'};

            camera.on('moveend', (d) => {
                t.equal(d.data, 'ok');
                t.end();
            });

            camera.rotateTo(90, {}, eventData);
            camera.stop();
        });

        t.test('does not emit moveend if not moving', (t) => {
            const camera = createCamera();
            const eventData = {data: 'ok'};

            camera.on('moveend', (d) => {
                t.equal(d.data, 'ok');
                camera.stop();
                t.end(); // Fails with ".end() called twice" if we get here a second time.
            });

            const stub = t.stub(browser, 'now');
            stub.callsFake(() => 0);
            camera.panTo([100, 0], {duration: 1}, eventData);

            setTimeout(() => {
                stub.callsFake(() => 1);
                camera.simulateFrame();
            }, 0);
        });

        t.end();
    });

    t.test('#cameraForBounds', (t) => {
        t.test('no options passed', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb);
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -100.5, lat: 34.7171}, 'correctly calculates coordinates for new bounds');
            t.equal(fixedNum(transform.zoom, 3), 2.469);
            t.end();
        });

        t.test('bearing positive number', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: 175});
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -100.5, lat: 34.7171}, 'correctly calculates coordinates for new bounds');
            t.equal(fixedNum(transform.zoom, 3), 2.396);
            t.equal(transform.bearing, 175);
            t.end();
        });

        t.test('bearing negative number', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: -30});
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -100.5, lat: 34.7171}, 'correctly calculates coordinates for new bounds');
            t.equal(fixedNum(transform.zoom, 3), 2.222);
            t.equal(transform.bearing, -30);
            t.end();
        });

        t.test('padding number', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {padding: 15});
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -100.5, lat: 34.7171}, 'correctly calculates coordinates for bounds with padding option as number applied');
            t.equal(fixedNum(transform.zoom, 3), 2.382);
            t.end();
        });

        t.test('padding object', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {padding: {top: 15, right: 15, bottom: 15, left: 15}, duration: 0});
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -100.5, lat: 34.7171}, 'correctly calculates coordinates for bounds with padding option as object applied');
            t.end();
        });

        t.test('asymmetrical padding', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, duration: 0});
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -96.5558, lat: 32.0833}, 'correctly calculates coordinates for bounds with padding option as object applied');
            t.end();
        });

        t.test('bearing and asymmetrical padding', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: 90, padding: {top: 10, right: 75, bottom: 50, left: 25}, duration: 0});
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -103.3761, lat: 31.7099}, 'correctly calculates coordinates for bounds with bearing and padding option as object applied');
            t.end();
        });

        t.test('bearing and asymmetrical padding and assymetrical viewport padding', (t) => {
            const camera = createCamera();
            camera.setPadding({left: 30, top: 35, right: 50, bottom: 65});
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: 90, padding: {top: 10, right: 75, bottom: 50, left: 25}, duration: 0});
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -104.1932, lat: 30.837});
            t.end();
        });

        t.test('offset', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {offset: [0, 100]});
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -100.5, lat: 44.4717}, 'correctly calculates coordinates for bounds with padding option as object applied');
            t.end();
        });

        t.test('offset as object', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {offset: {x: 0, y: 100}});
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -100.5, lat: 44.4717}, 'correctly calculates coordinates for bounds with padding option as object applied');
            t.end();
        });

        t.test('offset and padding', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, offset: [0, 100]});
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -96.5558, lat: 44.4189}, 'correctly calculates coordinates for bounds with padding option as object applied');
            t.end();
        });

        t.test('bearing, asymmetrical padding, and offset', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: 90, padding: {top: 10, right: 75, bottom: 50, left: 25}, offset: [0, 100], duration: 0});
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -103.3761, lat: 43.0929}, 'correctly calculates coordinates for bounds with bearing, padding option as object, and offset applied');
            t.end();
        });

        t.end();
    });

    t.test('#fitScreenCoordinates with globe', (t) => {
        t.test('bearing 225', (t) => {
            const camera = createCamera({projection: {name: 'globe'}});
            const p0 = [128, 128];
            const p1 = [256, 384];
            const bearing = 225;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), {lng: -39.7287, lat: 0});
            t.equal(fixedNum(camera.getZoom(), 3), 0.946);
            t.equal(camera.getBearing(), -135);
            t.equal(camera.getPitch(), 0);
            t.end();
        });

        t.test('bearing 225, pitch 30', (t) => {
            const pitch = 30;
            const camera = createCamera({projection: {name: 'globe'}, pitch});
            const p0 = [100, 500];
            const p1 = [300, 510];
            const bearing = 225;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), {lng: 17.5434, lat: -80.2279});
            t.equal(fixedNum(camera.getZoom(), 3), 1.311);
            t.equal(camera.getBearing(), -135);
            t.end();
        });

        t.test('bearing 0', (t) => {
            const camera = createCamera({projection: {name: 'globe'}});

            const p0 = [128, 128];
            const p1 = [256, 384];
            const bearing = 0;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), {lng: -39.7287, lat: 0});
            t.equal(fixedNum(camera.getZoom(), 3), 1.164);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.end();
    });

    t.test('#cameraForBounds with Globe', (t) => {
        t.test('no options passed', (t) => {
            const camera = createCamera({projection: {name: 'globe'}});
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb);
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -100.5, lat: 34.716});
            t.equal(fixedNum(transform.zoom, 3), 2.106);
            t.end();
        });

        t.test('bearing positive number', (t) => {
            const camera = createCamera({projection: {name: 'globe'}});
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: 175});
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -100.5, lat: 34.716});
            t.equal(fixedNum(transform.zoom, 3), 2.034);
            t.equal(transform.bearing, 175);
            t.end();
        });

        t.test('bearing negative number', (t) => {
            const camera = createCamera({projection: {name: 'globe'}});
            const bb = [[-133, 16], [-68, 50]];

            const transform = camera.cameraForBounds(bb, {bearing: -30});
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: -100.5, lat: 34.716});
            t.equal(fixedNum(transform.zoom, 3), 1.868);
            t.equal(transform.bearing, -30);
            t.end();
        });

        t.test('entire longitude range: -180 to 180', (t) => {
            const camera = createCamera({projection: {name: 'globe'}});
            const bb = [[-180, 10], [180, 50]];

            const transform = camera.cameraForBounds(bb);
            t.deepEqual(fixedLngLat(transform.center, 4), {lng: 180, lat: 80});
            t.equal(fixedNum(transform.zoom, 3), 1.072);
            t.end();
        });

        t.end();
    });

    t.test('#fitBounds', (t) => {
        t.test('no padding passed', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), {lng: -100.5, lat: 34.7171}, 'pans to coordinates based on fitBounds');
            t.equal(fixedNum(camera.getZoom(), 3), 2.469);
            t.end();
        });

        t.test('padding number', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {padding: 15, duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), {lng: -100.5, lat: 34.7171}, 'pans to coordinates based on fitBounds with padding option as number applied');
            t.equal(fixedNum(camera.getZoom(), 3), 2.382);
            t.end();
        });

        t.test('padding is calculated with bearing', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {bearing: 45, duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), {lng: -100.5, lat: 34.7171}, 'pans to coordinates based on fitBounds with bearing applied');
            t.equal(fixedNum(camera.getZoom(), 3), 2.254);
            t.end();
        });

        t.test('padding object', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), {lng: -96.5558, lat: 32.0833}, 'pans to coordinates based on fitBounds with padding option as object applied');
            t.end();
        });

        t.test('padding does not get propagated to transform.padding', (t) => {
            const camera = createCamera();
            const bb = [[-133, 16], [-68, 50]];

            camera.fitBounds(bb, {padding: {top: 10, right: 75, bottom: 50, left: 25}, duration:0});
            const padding = camera.transform.padding;
            t.deepEqual(padding, {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            });
            t.end();
        });

        t.end();
    });

    t.test('#fitScreenCoordinates', (t) => {
        t.test('bearing 225', (t) => {
            const camera = createCamera();
            const p0 = [128, 128];
            const p1 = [256, 384];
            const bearing = 225;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), {lng: -45, lat: 0}, 'centers, rotates 225 degrees, and zooms based on screen coordinates');
            t.equal(fixedNum(camera.getZoom(), 3), 0.915); // 0.915 ~= log2(4*sqrt(2)/3)
            t.equal(camera.getBearing(), -135);
            t.equal(camera.getPitch(), 0);
            t.end();
        });

        t.test('bearing 225, pitch 30', (t) => {
            const pitch = 30;
            const camera = createCamera({pitch});
            const p0 = [200, 500];
            const p1 = [210, 510];
            const bearing = 225;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), {lng: -30.215, lat: -84.1374}, 'centers, rotates 225 degrees, pitch 30 degrees, and zooms based on screen coordinates');
            t.equal(fixedNum(camera.getZoom(), 3), 5.2);
            t.equal(camera.getBearing(), -135);
            t.end();
        });

        t.test('bearing 225, pitch 80, over horizon', (t) => {
            const pitch = 80;
            const camera = createCamera({pitch});
            const p0 = [128, 0];
            const p1 = [256, 10];
            const bearing = 225;

            const zoom = camera.getZoom();
            const center = camera.getCenter();
            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), center, 'centers, rotates 225 degrees, pitch 80 degrees, and zooms based on screen coordinates');
            t.equal(fixedNum(camera.getZoom(), 3), zoom);
            t.equal(camera.getBearing(), 0);
            t.equal(camera.getPitch(), pitch);
            t.end();
        });

        t.test('bearing 0', (t) => {
            const camera = createCamera();

            const p0 = [128, 128];
            const p1 = [256, 384];
            const bearing = 0;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), {lng: -45, lat: 0}, 'centers and zooms in based on screen coordinates');
            t.equal(fixedNum(camera.getZoom(), 3), 1);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.test('inverted points', (t) => {
            const camera = createCamera();
            const p1 = [128, 128];
            const p0 = [256, 384];
            const bearing = 0;

            camera.fitScreenCoordinates(p0, p1, bearing, {duration:0});
            t.deepEqual(fixedLngLat(camera.getCenter(), 4), {lng: -45, lat: 0}, 'centers and zooms based on screen coordinates in opposite order');
            t.equal(fixedNum(camera.getZoom(), 3), 1);
            t.equal(camera.getBearing(), 0);
            t.end();
        });

        t.end();
    });

    test('FreeCameraOptions', (t) => {

        const camera = createCamera();

        const rotatedFrame = (quaternion) => {
            return {
                up: vec3.transformQuat([], [0, -1, 0], quaternion),
                forward: vec3.transformQuat([], [0, 0, -1], quaternion),
                right: vec3.transformQuat([], [1, 0, 0], quaternion)
            };
        };

        test('lookAtPoint', (t) => {
            const options = new FreeCameraOptions();
            const cosPi4 = fixedNum(1.0 / Math.sqrt(2.0));
            let frame = null;

            // Pitch: 45, bearing: 0
            options.position = new MercatorCoordinate(0.5, 0.5, 0.5);
            options.lookAtPoint(new LngLat(0.0, 85.051128779806604));
            t.true(options.orientation);
            frame = rotatedFrame(options.orientation);

            t.deepEqual(fixedVec3(frame.right), [1, 0, 0]);
            t.deepEqual(fixedVec3(frame.up), [0, -cosPi4, cosPi4]);
            t.deepEqual(fixedVec3(frame.forward), [0, -cosPi4, -cosPi4]);

            // Look directly to east
            options.position = new MercatorCoordinate(0.5, 0.5, 0.0);
            options.lookAtPoint(new LngLat(30, 0));
            t.true(options.orientation);
            frame = rotatedFrame(options.orientation);

            t.deepEqual(fixedVec3(frame.right), [0, 1, 0]);
            t.deepEqual(fixedVec3(frame.up), [0, 0, 1]);
            t.deepEqual(fixedVec3(frame.forward), [1, 0, 0]);

            // Pitch: 0, bearing: 0
            options.position = MercatorCoordinate.fromLngLat(new LngLat(24.9384, 60.1699), 100.0);
            options.lookAtPoint(new LngLat(24.9384, 60.1699), [0.0, -1.0, 0.0]);
            t.true(options.orientation);
            frame = rotatedFrame(options.orientation);

            t.deepEqual(fixedVec3(frame.right), [1.0, 0.0, 0.0]);
            t.deepEqual(fixedVec3(frame.up), [0.0, -1.0, 0.0]);
            t.deepEqual(fixedVec3(frame.forward), [0.0, 0.0, -1.0]);

            // Pitch: 0, bearing: 45
            options.position = MercatorCoordinate.fromLngLat(new LngLat(24.9384, 60.1699), 100.0);
            options.lookAtPoint(new LngLat(24.9384, 60.1699), [-1.0, -1.0, 0.0]);
            t.true(options.orientation);
            frame = rotatedFrame(options.orientation);

            t.deepEqual(fixedVec3(frame.right), [cosPi4, -cosPi4, 0.0]);
            t.deepEqual(fixedVec3(frame.up), [-cosPi4, -cosPi4, 0.0]);
            t.deepEqual(fixedVec3(frame.forward), [0.0, 0.0, -1.0]);

            // Looking south, up vector almost same as forward vector
            options.position = MercatorCoordinate.fromLngLat(new LngLat(122.4194, 37.7749));
            options.lookAtPoint(new LngLat(122.4194, 37.5), [0.0, 1.0, 0.00001]);
            t.true(options.orientation);
            frame = rotatedFrame(options.orientation);

            t.deepEqual(fixedVec3(frame.right), [-1.0, 0.0, 0.0]);
            t.deepEqual(fixedVec3(frame.up), [0.0, 0.0, 1.0]);
            t.deepEqual(fixedVec3(frame.forward), [0.0, 1.0, 0.0]);

            // Orientation with roll-component
            options.position = MercatorCoordinate.fromLngLat(new LngLat(151.2093, -33.8688));
            options.lookAtPoint(new LngLat(160.0, -33.8688), [0.0, -1.0, 0.1]);
            t.true(options.orientation);
            frame = rotatedFrame(options.orientation);

            t.deepEqual(fixedVec3(frame.right), [0.0, 1.0, 0.0]);
            t.deepEqual(fixedVec3(frame.up), [0.0, 0.0, 1.0]);
            t.deepEqual(fixedVec3(frame.forward), [1.0, 0.0, 0.0]);

            // Up vector pointing downwards
            options.position = new MercatorCoordinate(0.5, 0.5, 0.5);
            options.lookAtPoint(new LngLat(0.0, 85.051128779806604), [0.0, 0.0, -0.5]);
            t.true(options.orientation);
            frame = rotatedFrame(options.orientation);

            t.deepEqual(fixedVec3(frame.right), [1.0, 0.0, 0.0]);
            t.deepEqual(fixedVec3(frame.up), [0.0, -cosPi4, cosPi4]);
            t.deepEqual(fixedVec3(frame.forward), [0.0, -cosPi4, -cosPi4]);

            test('invalid input', (t) => {
                const options = new FreeCameraOptions();

                // Position not set
                options.orientation = [0, 0, 0, 0];
                options.lookAtPoint(new LngLat(0, 0));
                t.false(options.orientation);

                // Target same as position
                options.orientation = [0, 0, 0, 0];
                options.position = new MercatorCoordinate(0.5, 0.5, 0.0);
                options.lookAtPoint(new LngLat(0, 0));
                t.false(options.orientation);

                // Camera looking directly down without an explicit up vector
                options.orientation = [0, 0, 0, 0];
                options.position = new MercatorCoordinate(0.5, 0.5, 0.5);
                options.lookAtPoint(new LngLat(0, 0));
                t.false(options.orientation);

                // Zero length up vector
                options.orientation = [0, 0, 0, 0];
                options.lookAtPoint(new LngLat(0, 0), [0, 0, 0]);
                t.false(options.orientation);

                // Up vector same as direction
                options.orientation = [0, 0, 0, 0];
                options.lookAtPoint(new LngLat(0, 0), [0, 0, -1]);
                t.false(options.orientation);

                t.end();
            });

            t.end();
        });

        test('setPitchBearing', (t) => {
            const options = new FreeCameraOptions();
            const cos60 = fixedNum(Math.cos(60 * Math.PI / 180.0));
            const sin60 = fixedNum(Math.sin(60 * Math.PI / 180.0));
            let frame = null;

            options.setPitchBearing(0, 0);
            t.true(options.orientation);
            frame = rotatedFrame(options.orientation);
            t.deepEqual(fixedVec3(frame.right), [1, 0, 0]);
            t.deepEqual(fixedVec3(frame.up), [0, -1, 0]);
            t.deepEqual(fixedVec3(frame.forward), [0, 0, -1]);

            options.setPitchBearing(0, 180);
            t.true(options.orientation);
            frame = rotatedFrame(options.orientation);
            t.deepEqual(fixedVec3(frame.right), [-1, 0, 0]);
            t.deepEqual(fixedVec3(frame.up), [0, 1, 0]);
            t.deepEqual(fixedVec3(frame.forward), [0, 0, -1]);

            options.setPitchBearing(60, 0);
            t.true(options.orientation);
            frame = rotatedFrame(options.orientation);
            t.deepEqual(fixedVec3(frame.right), [1, 0, 0]);
            t.deepEqual(fixedVec3(frame.up), [0, -cos60, sin60]);
            t.deepEqual(fixedVec3(frame.forward), [0, -sin60, -cos60]);

            options.setPitchBearing(60, -450);
            t.true(options.orientation);
            frame = rotatedFrame(options.orientation);
            t.deepEqual(fixedVec3(frame.right), [0, -1, 0]);
            t.deepEqual(fixedVec3(frame.up), [-cos60, 0, sin60]);
            t.deepEqual(fixedVec3(frame.forward), [-sin60, 0, -cos60]);

            t.end();
        });

        t.test('emits move events', (t) => {
            let started, moved, ended;
            const eventData = {data: 'ok'};

            camera
                .on('movestart', (d) => { started = d.data; })
                .on('move', (d) => { moved = d.data; })
                .on('moveend', (d) => { ended = d.data; });

            const options = camera.getFreeCameraOptions();
            options.position.x = 0.2;
            options.position.y = 0.2;
            camera.setFreeCameraOptions(options, eventData);

            t.equal(started, 'ok');
            t.equal(moved, 'ok');
            t.equal(ended, 'ok');
            t.end();
        });

        t.test('changing orientation emits bearing events', (t) => {
            let rotatestarted, rotated, rotateended, pitch;
            const eventData = {data: 'ok'};

            camera
                .on('rotatestart', (d) => { rotatestarted = d.data; })
                .on('rotate', (d) => { rotated = d.data; })
                .on('rotateend', (d) => { rotateended = d.data; })
                .on('pitch', (d) => { pitch = d.data; });

            const options = camera.getFreeCameraOptions();
            quat.rotateZ(options.orientation, options.orientation, 0.1);
            camera.setFreeCameraOptions(options, eventData);

            t.equal(rotatestarted, 'ok');
            t.equal(rotated, 'ok');
            t.equal(rotateended, 'ok');
            t.equal(pitch, undefined);
            t.end();
        });

        t.test('changing orientation emits pitch events', (t) => {
            let  pitchstarted, pitch, pitchended, rotated;
            const eventData = {data: 'ok'};

            camera
                .on('pitchstart', (d) => { pitchstarted = d.data; })
                .on('pitch', (d) => { pitch = d.data; })
                .on('pitchend', (d) => { pitchended = d.data; })
                .on('rotate', (d) => { rotated = d.data; });

            const options = camera.getFreeCameraOptions();
            quat.rotateX(options.orientation, options.orientation, -0.1);
            camera.setFreeCameraOptions(options, eventData);

            t.equal(pitchstarted, 'ok');
            t.equal(pitch, 'ok');
            t.equal(pitchended, 'ok');
            t.equal(rotated, undefined);
            t.end();
        });

        t.test('changing altitude emits zoom events', (t) => {
            let zoomstarted, zoom, zoomended;
            const eventData = {data: 'ok'};

            camera
                .on('zoomstart', (d) => { zoomstarted = d.data; })
                .on('zoom', (d) => { zoom = d.data; })
                .on('zoomend', (d) => { zoomended = d.data; });

            const options = camera.getFreeCameraOptions();
            options.position.z *= 0.8;
            camera.setFreeCameraOptions(options, eventData);

            t.equal(zoomstarted, 'ok');
            t.equal(zoom, 'ok');
            t.equal(zoomended, 'ok');
            t.end();
        });

        t.end();
    });

    t.end();
});
