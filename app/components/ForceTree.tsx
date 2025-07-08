'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ForceTreeNode, ForceTreeLink } from '@/app/lib/forceTreeProcessor';

interface ForceTreeProps {
  data: {
    nodes: ForceTreeNode[];
    links: ForceTreeLink[];
  };
  width: number;
  height: number;
}

const ForceTree: React.FC<ForceTreeProps> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = useState<ForceTreeNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<ForceTreeNode | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Create container with zoom
    const g = svg.append('g');
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Color scales
    const genreColors = d3.scaleOrdinal(d3.schemeSet3);
    const nodeColors = {
      genre: '#ff00ff', // Magenta/Pink for genres
      artist: '#00ffff', // Cyan for artists
      track: '#00ff00'  // Green for tracks
    };

    // Size scales
    const sizeScale = d3.scaleLinear()
      .domain([0, 100])
      .range([5, 15]);

    const genreSizeScale = d3.scaleLinear()
      .domain([0, d3.max(data.nodes.filter(n => n.type === 'genre'), d => d.value) || 1000])
      .range([20, 40]);

    // Create force simulation
    const simulation = d3.forceSimulation<ForceTreeNode>()
      .force('link', d3.forceLink<ForceTreeNode, ForceTreeLink>()
        .id(d => d.id)
        .distance(d => {
          const sourceNode = data.nodes.find(n => n.id === (d.source as any).id || d.source);
          const targetNode = data.nodes.find(n => n.id === (d.target as any).id || d.target);
          if (sourceNode?.type === 'genre' && targetNode?.type === 'artist') return 150;
          if (sourceNode?.type === 'artist' && targetNode?.type === 'track') return 80;
          return 100;
        })
        .strength(0.5))
      .force('charge', d3.forceManyBody<ForceTreeNode>()
        .strength(d => {
          // Adjust charge strength based on total node count
          const nodeCount = data.nodes.length;
          const scaleFactor = nodeCount > 800 ? 0.7 : 1;
          
          if (d.type === 'genre') return -1000 * scaleFactor;
          if (d.type === 'artist') return -300 * scaleFactor;
          return -100 * scaleFactor;
        }))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<ForceTreeNode>()
        .radius(d => {
          if (d.type === 'genre') return genreSizeScale(d.value) + 10;
          return sizeScale(d.popularity || 50) + 5;
        }))
      // Add radial force to create tree-like structure
      .force('radial', d3.forceRadial<ForceTreeNode>(
        d => {
          // Adjust radial distances based on node count
          const nodeCount = data.nodes.length;
          const distanceScale = nodeCount > 800 ? 1.3 : 1;
          
          if (d.type === 'genre') return 0;
          if (d.type === 'artist') return 200 * distanceScale;
          return 350 * distanceScale;
        },
        width / 2,
        height / 2
      ).strength(d => d.type === 'genre' ? 0.8 : 0.3));

    // Create links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(data.links)
      .enter().append('line')
      .attr('stroke', '#444')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', d => Math.sqrt(d.value / 20));

    // Create node groups
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(data.nodes)
      .enter().append('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, ForceTreeNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles for nodes
    node.append('circle')
      .attr('r', d => {
        if (d.type === 'genre') return genreSizeScale(d.value);
        return sizeScale(d.popularity || 50);
      })
      .attr('fill', d => nodeColors[d.type])
      .attr('fill-opacity', 0.8)
      .attr('stroke', d => nodeColors[d.type])
      .attr('stroke-width', 2)
      .style('filter', 'url(#glow)');

    // Add labels
    const labels = node.append('text')
      .text(d => d.name)
      .attr('font-size', d => {
        if (d.type === 'genre') return '14px';
        if (d.type === 'artist') return '12px';
        return '10px';
      })
      .attr('dx', d => {
        if (d.type === 'genre') return 0;
        return sizeScale(d.popularity || 50) + 5;
      })
      .attr('dy', d => d.type === 'genre' ? 4 : 3)
      .attr('text-anchor', d => d.type === 'genre' ? 'middle' : 'start')
      .attr('fill', '#fff')
      .attr('opacity', d => d.type === 'track' ? 0.7 : 1)
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    // Add hover and click interactions
    node
      .on('mouseenter', function(event, d) {
        setHoveredNode(d);
        d3.select(this).select('circle')
          .transition()
          .duration(200)
          .attr('r', () => {
            const baseRadius = d.type === 'genre' ? 
              genreSizeScale(d.value) : 
              sizeScale(d.popularity || 50);
            return baseRadius * 1.2;
          });
      })
      .on('mouseleave', function(event, d) {
        setHoveredNode(null);
        d3.select(this).select('circle')
          .transition()
          .duration(200)
          .attr('r', () => {
            if (d.type === 'genre') return genreSizeScale(d.value);
            return sizeScale(d.popularity || 50);
          });
      })
      .on('click', function(event, d) {
        event.stopPropagation();
        if (d.spotifyUrl) {
          window.open(d.spotifyUrl, '_blank');
        }
        setSelectedNode(d);
      });

    // Define glow filter
    const defs = svg.append('defs');
    const filter = defs.append('filter')
      .attr('id', 'glow');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
      .attr('in', 'coloredBlur');
    feMerge.append('feMergeNode')
      .attr('in', 'SourceGraphic');

    // Update positions on tick
    simulation.nodes(data.nodes).on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    (simulation.force('link') as any).links(data.links);

    // Drag functions
    function dragstarted(event: any, d: ForceTreeNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: ForceTreeNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: ForceTreeNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [data, width, height]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ background: '#0a0a0a' }}
      />
      
      {/* Tooltip */}
      {hoveredNode && (
        <div
          className="absolute bg-gray-900 text-white p-2 rounded shadow-lg pointer-events-none z-10"
          style={{
            left: '50%',
            top: '20px',
            transform: 'translateX(-50%)',
            border: `1px solid ${
              hoveredNode.type === 'genre' ? '#ff00ff' :
              hoveredNode.type === 'artist' ? '#00ffff' : '#00ff00'
            }`
          }}
        >
          <div className="font-semibold">{hoveredNode.name}</div>
          <div className="text-sm text-gray-400">
            {hoveredNode.type.charAt(0).toUpperCase() + hoveredNode.type.slice(1)}
          </div>
          {hoveredNode.popularity && (
            <div className="text-sm">Popularity: {hoveredNode.popularity}</div>
          )}
        </div>
      )}
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-80 p-3 rounded">
        <div className="text-white text-sm space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff00ff' }}></div>
            <span>Genres</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#00ffff' }}></div>
            <span>Artists</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#00ff00' }}></div>
            <span>Tracks</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForceTree; 