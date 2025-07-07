'use client';

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphLink } from '@/app/types/spotify';

interface ForceGraphProps {
  data: GraphData;
  width?: number;
  height?: number;
  viewMode?: 'network' | 'hierarchical';
}

const ForceGraph: React.FC<ForceGraphProps> = ({ data, width = 1200, height = 800, viewMode = 'network' }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Color scales for different node types
    const colorScale = {
      genre: '#FF10F0', // neon-pink
      artist: '#00FFF0', // neon-blue
      track: '#39FF14', // neon-green
    };

    // Create container for zoom
    const container = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Dynamic parameters based on node count
    const nodeCount = data.nodes.length;
    const isSmall = nodeCount <= 400;
    const isMedium = nodeCount <= 800;
    const isLarge = nodeCount <= 1200;
    
    // Adjust parameters based on size
    const linkDistance = isSmall ? 120 : isMedium ? 100 : isLarge ? 80 : 60;
    const genreLinkDistance = isSmall ? 150 : isMedium ? 130 : isLarge ? 100 : 80;
    const chargeStrength = isSmall ? -600 : isMedium ? -400 : isLarge ? -250 : -150;
    const genreChargeStrength = isSmall ? -800 : isMedium ? -600 : isLarge ? -400 : -250;
    const distanceMax = isSmall ? 500 : isMedium ? 400 : isLarge ? 300 : 200;
    const collisionPadding = isSmall ? 10 : isMedium ? 8 : isLarge ? 6 : 4;
    const alphaDecay = isSmall ? 0.02 : isMedium ? 0.03 : isLarge ? 0.04 : 0.05;
    const velocityDecay = isSmall ? 0.3 : isMedium ? 0.35 : isLarge ? 0.4 : 0.5;
    const linkOpacity = isSmall ? 0.2 : isMedium ? 0.15 : isLarge ? 0.1 : 0.05;
    const tickFrequency = isSmall ? 1 : isMedium ? 2 : isLarge ? 2 : 3;
    const minLabelRadius = isSmall ? 10 : isMedium ? 12 : isLarge ? 15 : 18;

    // Hierarchical positioning for y-axis
    const isHierarchical = viewMode === 'hierarchical';
    const verticalPadding = height * 0.15;
    const genreY = verticalPadding;
    const artistY = height / 2;
    const trackY = height - verticalPadding;

    // Create force simulation with dynamic parameters
    const simulation = d3.forceSimulation<GraphNode>()
      .force('link', d3.forceLink<GraphNode, GraphLink>()
        .id((d) => d.id)
        .distance((d) => {
          const source = data.nodes.find(n => n.id === (d.source as any).id || n.id === d.source);
          const target = data.nodes.find(n => n.id === (d.target as any).id || n.id === d.target);
          
          if (isHierarchical) {
            // Shorter distances for hierarchical clustering
            if ((source?.group === 'genre' && target?.group === 'artist') ||
                (source?.group === 'artist' && target?.group === 'genre')) {
              return (genreLinkDistance * 0.6) / d.strength;
            }
            if ((source?.group === 'artist' && target?.group === 'track') ||
                (source?.group === 'track' && target?.group === 'artist')) {
              return (linkDistance * 0.6) / d.strength;
            }
          }
          
          if (source?.group === 'genre' || target?.group === 'genre') {
            return genreLinkDistance / d.strength;
          }
          return linkDistance / d.strength;
        })
        .strength((d) => {
          if (isHierarchical) {
            const source = data.nodes.find(n => n.id === (d.source as any).id || n.id === d.source);
            const target = data.nodes.find(n => n.id === (d.target as any).id || n.id === d.target);
            
            // Stronger attraction for parent-child relationships
            if ((source?.group === 'genre' && target?.group === 'artist') ||
                (source?.group === 'artist' && target?.group === 'genre')) {
              return d.strength * 1.2;
            }
            if ((source?.group === 'artist' && target?.group === 'track') ||
                (source?.group === 'track' && target?.group === 'artist')) {
              return d.strength * 1.2;
            }
          }
          return d.strength * (isSmall ? 0.8 : isMedium ? 0.7 : 0.5);
        }))
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength((d) => {
          if (isHierarchical) {
            // Reduced repulsion for hierarchical clustering
            if (d.group === 'genre') {
              return (genreChargeStrength * 0.5) - (d.radius || 10) * 3;
            }
            return (chargeStrength * 0.5) - (d.radius || 10);
          }
          
          if (d.group === 'genre') {
            return genreChargeStrength - (d.radius || 10) * 5;
          }
          return chargeStrength - (d.radius || 10) * 2;
        })
        .distanceMax(distanceMax))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>()
        .radius((d) => (d.radius || 10) + (isHierarchical ? collisionPadding * 0.7 : collisionPadding))
        .strength(0.7)
        .iterations(isSmall ? 2 : 1))
      .alphaDecay(alphaDecay)
      .velocityDecay(velocityDecay);

    // Add vertical positioning forces for hierarchical view
    if (isHierarchical) {
      simulation
        .force('y', d3.forceY<GraphNode>()
          .y((d) => {
            if (d.group === 'genre') return genreY;
            if (d.group === 'artist') return artistY;
            return trackY;
          })
          .strength(0.5));
      
      // Add slight horizontal spreading to prevent overlap
      simulation
        .force('x', d3.forceX<GraphNode>()
          .x(width / 2)
          .strength(0.05));
    }

    // Create links with dynamic opacity
    const link = container.append('g')
      .selectAll('line')
      .data(data.links)
      .enter().append('line')
      .attr('stroke', '#ffffff')
      .attr('stroke-opacity', linkOpacity)
      .attr('stroke-width', (d) => d.strength * (isSmall ? 1.5 : 1));

    // Create node groups
    const node = container.append('g')
      .selectAll('g')
      .data(data.nodes)
      .enter().append('g')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles to nodes with standard styling
    node.append('circle')
      .attr('r', (d) => d.radius || 10)
      .attr('fill', (d) => colorScale[d.group])
      .attr('stroke', (d) => colorScale[d.group])
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.8)
      .style('filter', 'url(#glow)');

    // Add labels with dynamic visibility
    node.append('text')
      .text((d) => d.name)
      .attr('x', 0)
      .attr('y', (d) => (d.radius || 10) + 15)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ffffff')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .style('text-shadow', '0 0 10px rgba(255, 255, 255, 0.5)')
      .style('display', (d) => {
        // Dynamic label hiding based on node count
        if (d.group === 'track' && (d.radius || 10) < minLabelRadius) {
          return 'none';
        }
        if (d.group === 'artist' && (d.radius || 10) < minLabelRadius + 5) {
          return 'none';
        }
        return 'block';
      });

    // Add hierarchy labels for hierarchical view
    if (isHierarchical) {
      const labels = container.append('g')
        .attr('class', 'hierarchy-labels');
      
      labels.append('text')
        .attr('x', 50)
        .attr('y', genreY)
        .attr('text-anchor', 'start')
        .attr('fill', colorScale.genre)
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('opacity', 0.7)
        .text('GENRES');
      
      labels.append('text')
        .attr('x', 50)
        .attr('y', artistY)
        .attr('text-anchor', 'start')
        .attr('fill', colorScale.artist)
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('opacity', 0.7)
        .text('ARTISTS');
      
      labels.append('text')
        .attr('x', 50)
        .attr('y', trackY)
        .attr('text-anchor', 'start')
        .attr('fill', colorScale.track)
        .attr('font-size', '14px')
        .attr('font-weight', 'bold')
        .attr('opacity', 0.7)
        .text('TRACKS');
    }

    // Add glow filter
    const defs = svg.append('defs');
    
    const filter = defs.append('filter')
      .attr('id', 'glow');
    
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'coloredBlur');
    
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
      .attr('in', 'coloredBlur');
    feMerge.append('feMergeNode')
      .attr('in', 'SourceGraphic');

    // Add tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('padding', '10px')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('border', '1px solid currentColor')
      .style('border-radius', '5px')
      .style('color', '#ffffff')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000);

    node.on('mouseover', (event, d) => {
      tooltip.transition()
        .duration(200)
        .style('opacity', .9);
      
      tooltip.html(`
        <div style="color: ${colorScale[d.group]}">
          <strong>${d.name}</strong><br/>
          ${d.group === 'track' || d.group === 'artist' ? `Popularity: ${d.popularity}` : ''}
        </div>
      `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px')
        .style('border-color', colorScale[d.group]);
    })
    .on('mouseout', () => {
      tooltip.transition()
        .duration(500)
        .style('opacity', 0);
    })
    .on('click', (event, d) => {
      if (d.spotifyUrl) {
        window.open(d.spotifyUrl, '_blank');
      }
    });

    // Set simulation nodes and links
    simulation.nodes(data.nodes);
    (simulation.force('link') as d3.ForceLink<GraphNode, GraphLink>).links(data.links);

    // Update positions on tick with dynamic frequency
    let tickCount = 0;
    simulation.on('tick', () => {
      tickCount++;
      
      // Update less frequently for better performance with many nodes
      if (tickCount % tickFrequency === 0) {
        link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

        node
          .attr('transform', (d) => `translate(${d.x},${d.y})`);
      }
    });

    // Drag functions
    function dragstarted(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Cleanup
    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [data, width, height, viewMode]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="graph-container"
      style={{ cursor: 'grab' }}
    />
  );
};

export default ForceGraph; 