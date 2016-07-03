import Backbone from 'backbone';
import template from './mark.jade';
import './mark.less';

export class Mark extends Backbone.View {

	initialize({
		model = new Backbone.Model({ x: 10, y: 10 })
	} = {}) {
		this.model = model;
		this.model.on('change', () => this.render());
	}

	render() {
		const { x, y } = this.model.toJSON();
		const center = {
			x: window.innerWidth / 2,
			y: window.innerHeight / 2,
		};
		const pos = `(${x}, ${y})`;
		const options = {};
		if (x > center.x) {
			if (y > center.y) {
				options.textTopLeft = pos;
			} else {
				options.textBottomLeft = pos;
			}
		} else {
			if (y > center.y) {
				options.textTopRight = pos;
			} else {
				options.textBottomRight = pos;
			}
		}
		this.$el.html(template(options));
		this.$('.mark').css({
			left: x - 10,
			top: y - 10,
		});
		return this;
	}
}

