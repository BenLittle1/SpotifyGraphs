'use client';

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphLink } from '@/app/types/spotify';

interface ForceGraphProps {
  data: GraphData;
  width?: number;
  height?: number;
}

const ForceGraph: React.FC<ForceGraphProps> = ({ data, width = 1200, height = 800 }) => {
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

    // Create force simulation with optimizations for more nodes
    const simulation = d3.forceSimulation<GraphNode>()
      .force('link', d3.forceLink<GraphNode, GraphLink>()
        .id((d) => d.id)
        .distance((d) => {
          // Increase distance for links involving genre nodes
          const source = data.nodes.find(n => n.id === (d.source as any).id || n.id === d.source);
          const target = data.nodes.find(n => n.id === (d.target as any).id || n.id === d.target);
          if (source?.group === 'genre' || target?.group === 'genre') {
            return 150 / d.strength;
          }
          return 100 / d.strength;
        })
        .strength((d) => d.strength * 0.8)) // Slightly weaker links for better spread
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength((d) => {
          // Stronger repulsion for genre nodes
          if (d.group === 'genre') {
            return -600 - (d.radius || 10) * 10;
          }
          return -250 - (d.radius || 10) * 3;
        })
        .distanceMax(500)) // Limit force calculation distance for performance
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<GraphNode>()
        .radius((d) => (d.radius || 10) + 8) // Slightly less padding for denser packing
        .strength(0.7)
        .iterations(2)) // More iterations for better collision detection
      .alphaDecay(0.02) // Faster settling for performance
      .velocityDecay(0.3); // More damping to prevent jittering

    // Create links with reduced opacity for clarity with more nodes
    const link = container.append('g')
      .selectAll('line')
      .data(data.links)
      .enter().append('line')
      .attr('stroke', '#ffffff')
      .attr('stroke-opacity', 0.15) // Lower opacity with more links
      .attr('stroke-width', (d) => d.strength * 1.5);

    // Create node groups
    const node = container.append('g')
      .selectAll('g')
      .data(data.nodes)
      .enter().append('g')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles to nodes with enhanced glow for genres
    node.append('circle')
      .attr('r', (d) => d.radius || 10)
      .attr('fill', (d) => colorScale[d.group])
      .attr('stroke', (d) => colorScale[d.group])
      .attr('stroke-width', (d) => d.group === 'genre' ? 3 : 2)
      .attr('stroke-opacity', (d) => d.group === 'genre' ? 1 : 0.8)
      .style('filter', (d) => d.group === 'genre' ? 'url(#glow-strong)' : 'url(#glow)');

    // Add labels with different sizing for genres - hide small track labels for clarity
    node.append('text')
      .text((d) => d.name)
      .attr('x', 0)
      .attr('y', (d) => (d.radius || 10) + 15)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ffffff')
      .attr('font-size', (d) => d.group === 'genre' ? '16px' : '12px')
      .attr('font-weight', 'bold')
      .style('text-shadow', '0 0 10px rgba(255, 255, 255, 0.5)')
      .style('display', (d) => {
        // Hide labels for small track nodes to reduce clutter
        if (d.group === 'track' && (d.radius || 10) < 12) {
          return 'none';
        }
        return 'block';
      });

    // Add glow filters
    const defs = svg.append('defs');
    
    // Regular glow
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

    // Strong glow for genres
    const filterStrong = defs.append('filter')
      .attr('id', 'glow-strong');
    
    filterStrong.append('feGaussianBlur')
      .attr('stdDeviation', '8')
      .attr('result', 'coloredBlur');
    
    const feMergeStrong = filterStrong.append('feMerge');
    feMergeStrong.append('feMergeNode')
      .attr('in', 'coloredBlur');
    feMergeStrong.append('feMergeNode')
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
      
      let content = `<div style="color: ${colorScale[d.group]}">
        <strong>${d.name}</strong><br/>`;
      
      if (d.group === 'genre') {
        const connectedArtists = data.links.filter(l => 
          (l.source === d.id || l.target === d.id)
        ).length;
        content += `Connected Artists: ${connectedArtists}`;
      } else if (d.group === 'track' || d.group === 'artist') {
        content += `Popularity: ${d.popularity}`;
      }
      
      content += '</div>';
      
      tooltip.html(content)
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

    // Update positions on tick with performance optimization
    let tickCount = 0;
    simulation.on('tick', () => {
      tickCount++;
      
      // Update less frequently for better performance with many nodes
      if (tickCount % 2 === 0) {
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
  }, [data, width, height]);

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