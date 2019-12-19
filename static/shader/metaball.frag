#ifdef GL_ES
precision mediump float;
#endif

#define MAX_NUM_METABALLS 25
#define RADIUS 0.065

#define NO_THRESHOLDING false
#define SHOW_THRESHOLD true

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

#define QUADRATIC 1
#define NEG_QUADRATIC 2
#define LINEAR 3
#define ZERO 4

uniform int u_metaball_kind[MAX_NUM_METABALLS];
uniform vec2 u_metaball_pos[MAX_NUM_METABALLS];
uniform float u_metaball_radius[MAX_NUM_METABALLS];
uniform int u_num_metaballs;
uniform float u_threshold;

vec4 grayscale(float value) {
    return vec4(vec3(value), 1.);
}

vec4 color_for_density(float density) {
    if (NO_THRESHOLDING) {
      if (SHOW_THRESHOLD && (u_threshold < density)
           && (density < u_threshold + 0.005)) {
        // return vec4(1., 0., 0., 1.);
        return grayscale(density - 0.05);
      }
      return grayscale(density);
    }
    if (density > u_threshold) {
        return grayscale(0.0);
    }
    return grayscale(0.89);
}

float quadratic_density(vec2 frag_pos, vec2 pos, float radius) {
  return radius * radius / dot((frag_pos - pos), (frag_pos - pos));
}
float neg_quadratic_density(vec2 frag_pos, vec2 pos, float radius) {
  return -quadratic_density(frag_pos, pos, radius);
}
float linear_density(vec2 frag_pos, vec2 pos, float radius) {
  return 0.2 * radius * radius / sqrt(dot((frag_pos - pos),
                                          (frag_pos - pos)));
}
float zero_density(vec2 frag_pos, vec2 pos, float radius) {
  return 0.;
}

float density_for_ball(vec2 frag_pos, int kind, vec2 pos, float radius) {
  if (kind == QUADRATIC) {
    return quadratic_density(frag_pos, pos, radius);
  } else if (kind == NEG_QUADRATIC) {
    return neg_quadratic_density(frag_pos, pos, radius);
  } else if (kind == LINEAR) {
    return linear_density(frag_pos, pos, radius);
  } else if (kind == ZERO) {
    return 0.;
  }
  return 0.;
}

void main() {
    // vec2 frag_pos = gl_FragCoord.xy / vec2(u_resolution[0], u_resolution[0]);
    float aspect_ratio = u_resolution.x / u_resolution.y;
    vec2 frag_pos = 2. * (gl_FragCoord.xy - u_resolution / 2.)
                    / u_resolution;
    if (u_resolution.x < u_resolution.y) {
      frag_pos.y /= aspect_ratio;
    } else {
     frag_pos.x *= aspect_ratio;
    }

    float density = 0.;
    for (int i = 0; i < MAX_NUM_METABALLS; i++) {
        if (i >= u_num_metaballs) {
          break;
        }
        // vec2 pos = u_metaball_pos[i];
        density += density_for_ball(frag_pos,
                                    u_metaball_kind[i],
                                    u_metaball_pos[i],
                                    u_metaball_radius[i]);
        // float single_ball_density =
        //  (u_metaball_radius[i] * u_metaball_radius[i])
        //   / dot((frag_pos - pos), (frag_pos - pos));
        // density += single_ball_density;
    }
    
    
    gl_FragColor = color_for_density(density);
}
