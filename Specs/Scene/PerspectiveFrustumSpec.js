/*global defineSuite*/
defineSuite([
         'Scene/PerspectiveFrustum',
         'Core/Cartesian2',
         'Core/Cartesian3',
         'Core/Cartesian4',
         'Core/Matrix4',
         'Core/Math'
     ], function(
         PerspectiveFrustum,
         Cartesian2,
         Cartesian3,
         Cartesian4,
         Matrix4,
         CesiumMath) {
    "use strict";
    /*global jasmine,describe,xdescribe,it,xit,expect,beforeEach,afterEach,beforeAll,afterAll,spyOn,runs,waits,waitsFor*/

    var frustum, planes;

    beforeEach(function() {
        frustum = new PerspectiveFrustum();
        frustum.near = 1.0;
        frustum.far = 2.0;
        frustum.fovy = (Math.PI) / 3;
        frustum.aspectRatio = 1.0;
        planes = frustum.computeCullingVolume(new Cartesian3(), Cartesian3.UNIT_Z.negate(), Cartesian3.UNIT_Y).planes;
    });

    it('out of range fov causes an exception', function() {
        frustum.fovy = -1.0;
        expect(function() {
            return frustum.projectionMatrix;
        }).toThrow();

        frustum.fovy = CesiumMath.TWO_PI;
        expect(function() {
            return frustum.projectionMatrix;
        }).toThrow();
    });

    it('negative aspect ratio throws an exception', function() {
        frustum.aspectRatio = -1.0;
        expect(function() {
            return frustum.projectionMatrix;
        }).toThrow();
    });

    it('out of range near plane throws an exception', function() {
        frustum.near = -1.0;
        expect(function() {
            return frustum.projectionMatrix;
        }).toThrow();
    });

    it('negative far plane throws an exception', function() {
        frustum.far = -1.0;
        expect(function() {
            return frustum.projectionMatrix;
        }).toThrow();
    });

    it('computeCullingVolume with no position throws an exception', function() {
        expect(function() {
            return frustum.computeCullingVolume();
        }).toThrow();
    });

    it('computeCullingVolume with no direction throws an exception', function() {
        expect(function() {
            return frustum.computeCullingVolume(new Cartesian3());
        }).toThrow();
    });

    it('computeCullingVolume with no up throws an exception', function() {
        expect(function() {
            return frustum.computeCullingVolume(new Cartesian3(), new Cartesian3());
        }).toThrow();
    });

    it('get frustum left plane', function() {
        var leftPlane = planes[0];
        var expectedResult = new Cartesian4(Math.sqrt(3.0) / 2.0, 0.0, -0.5, 0.0);
        expect(leftPlane).toEqualEpsilon(expectedResult, CesiumMath.EPSILON14);
    });

    it('get frustum right plane', function() {
        var rightPlane = planes[1];
        var expectedResult = new Cartesian4(-Math.sqrt(3.0) / 2.0, 0.0, -0.5, 0.0);
        expect(rightPlane).toEqualEpsilon(expectedResult, CesiumMath.EPSILON14);
    });

    it('get frustum bottom plane', function() {
        var bottomPlane = planes[2];
        var expectedResult = new Cartesian4(0.0, Math.sqrt(3.0) / 2.0, -0.5, 0.0);
        expect(bottomPlane).toEqualEpsilon(expectedResult, CesiumMath.EPSILON14);
    });

    it('get frustum top plane', function() {
        var topPlane = planes[3];
        var expectedResult = new Cartesian4(0.0, -Math.sqrt(3.0) / 2.0, -0.5, 0.0);
        expect(topPlane).toEqualEpsilon(expectedResult, CesiumMath.EPSILON14);
    });

    it('get frustum near plane', function() {
        var nearPlane = planes[4];
        var expectedResult = new Cartesian4(0.0, 0.0, -1.0, -1.0);
        expect(nearPlane).toEqual(expectedResult);
    });

    it('get frustum far plane', function() {
        var farPlane = planes[5];
        var expectedResult = new Cartesian4(0.0, 0.0, 1.0, 2.0);
        expect(farPlane).toEqual(expectedResult);
    });

    it('get perspective projection matrix', function() {
        var projectionMatrix = frustum.projectionMatrix;
        var expected = Matrix4.computePerspectiveFieldOfView(frustum.fovy, frustum.aspectRatio, frustum.near, frustum.far);
        expect(projectionMatrix).toEqualEpsilon(expected, CesiumMath.EPSILON6);
    });

    it('get infinite perspective matrix', function() {
        var top = frustum.near * Math.tan(0.5 * frustum.fovy);
        var bottom = -top;
        var right = frustum.aspectRatio * top;
        var left = -right;
        var near = frustum.near;

        var expected = Matrix4.computeInfinitePerspectiveOffCenter(left, right, bottom, top, near);
        expect(frustum.infiniteProjectionMatrix).toEqual(expected);
    });

    it('get pixel size throws without canvas dimensions', function() {
        expect(function() {
            return frustum.getPixelSize();
        }).toThrow();
    });

    it('get pixel size', function() {
        var dimensions = new Cartesian2(1.0, 1.0);
        var pixelSize = frustum.getPixelSize(dimensions);
        var expected = frustum._offCenterFrustum.getPixelSize(dimensions);
        expect(pixelSize.x).toEqual(expected.x);
        expect(pixelSize.y).toEqual(expected.y);
    });

    it('equals', function() {
        var frustum2 = new PerspectiveFrustum();
        frustum2.near = 1.0;
        frustum2.far = 2.0;
        frustum2.fovy = (Math.PI) / 3.0;
        frustum2.aspectRatio = 1.0;
        frustum2.position = new Cartesian3();
        frustum2.direction =  Cartesian3.UNIT_Z.negate();
        frustum2.up = Cartesian3.UNIT_Y;
        expect(frustum.equals(frustum2)).toEqual(true);
    });

    it('equals undefined', function() {
        expect(frustum.equals()).toEqual(false);
    });

    it('throws with undefined frustum parameters', function() {
        var frustum = new PerspectiveFrustum();
        expect(function() {
            return frustum.infiniteProjectionMatrix;
        }).toThrow();
    });
});
