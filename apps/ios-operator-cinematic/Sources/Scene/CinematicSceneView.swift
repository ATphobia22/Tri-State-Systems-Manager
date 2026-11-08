import SwiftUI
import SceneKit

struct CinematicSceneView: UIViewRepresentable {
    @ObservedObject var controller: CitySceneController

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView(frame: .zero)
        view.scene = controller.scene
        view.pointOfView = controller.pointOfView
        view.backgroundColor = .black
        view.allowsCameraControl = true
        view.defaultCameraController.interactionMode = .orbitTurntable
        view.antialiasingMode = .multisampling4X
        view.isPlaying = true
        view.preferredFramesPerSecond = 60
        view.autoenablesDefaultLighting = false
        view.rendersContinuously = true
        view.addGestureRecognizer(UITapGestureRecognizer(target: context.coordinator,
                                                          action: #selector(Coordinator.tapped(_:))))
        return view
    }

    func updateUIView(_ uiView: SCNView, context: Context) {
        if uiView.scene !== controller.scene { uiView.scene = controller.scene }
        uiView.pointOfView = controller.pointOfView
    }

    func makeCoordinator() -> Coordinator { Coordinator(controller: controller) }

    final class Coordinator: NSObject {
        let controller: CitySceneController
        init(controller: CitySceneController) { self.controller = controller }

        @objc func tapped(_ gesture: UITapGestureRecognizer) {
            guard let view = gesture.view as? SCNView else { return }
            let hits = view.hitTest(gesture.location(in: view), options: [.firstFoundOnly: true])
            if let node = hits.first?.node { controller.selectNode(node) }
        }
    }
}
