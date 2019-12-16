#ifdef GL_ES
precision mediump float;
#endif

#define MAX_NUM_METABALLS 10
#define RADIUS 0.065

#define DEBUG_DENSITY false

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

uniform vec2 u_metaball_pos[MAX_NUM_METABALLS];
uniform float u_metaball_radius[MAX_NUM_METABALLS];
uniform int u_num_metaballs;
uniform float u_threshold;

vec4 grayscale(float value) {
    return vec4(vec3(value), 1.);
}

vec4 color_for_density(float density) {
    if (DEBUG_DENSITY) {
      if ((u_threshold < density)
           && (density < u_threshold + 0.005)) {
        // return vec4(1., 0., 0., 1.);
        return grayscale(density - 0.05);
      }
      return grayscale(density);
    }
    if (density > u_threshold) {
        return grayscale(0.0);
    }
    return grayscale(0.91);
}

void main() {
    // vec2 frag_pos = gl_FragCoord.xy / vec2(u_resolution[0], u_resolution[0]);
    float aspect_ratio = u_resolution.x / u_resolution.y;
    vec2 frag_pos = 2. * (gl_FragCoord.xy - u_resolution / 2.)
                    / u_resolution;
    // frag_pos.x /= max(1., aspect_ratio);
    // frag_pos.y /= min(1., aspect_ratio);
    if (u_resolution.x < u_resolution.y) {
      frag_pos.y /= aspect_ratio;
    } else {
     frag_pos.x *= aspect_ratio;
    }


    float density = 0.;
    for (int i = 0; i < MAX_NUM_METABALLS; i++) {
        if (i >= u_num_metaballs) {
          continue;
        }
        vec2 pos = u_metaball_pos[i];
        float single_ball_density =
          (u_metaball_radius[i] * u_metaball_radius[i])
          / dot((frag_pos - pos), (frag_pos - pos));
        density += single_ball_density;
    }
    
    
    gl_FragColor = color_for_density(density);
}
